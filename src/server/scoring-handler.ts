import type { CommunicationMetrics } from "../engine/communication-metrics";
import type { ProposedWeakness, ScoringRequest, ScoringResponse } from "../engine/debrief";
import { verifyScores } from "../engine/evidence";
import type { ProposedScore } from "../engine/evidence";
import { LEVELS } from "../engine/ports";
import { COMPETENCIES, isOneOf } from "../engine/types";
import type { Competency } from "../engine/types";
import { rubricFor } from "../rubric/rubric";
import { isTranscriptEntry } from "./turn-handler";
import type { GenerateReply } from "./turn-handler";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function isMetrics(value: unknown): value is CommunicationMetrics {
  if (typeof value !== "object" || value === null) return false;
  const { longestSilenceMs, answers, nudgeCount, hintCount } = value as Record<string, unknown>;
  return (
    isNumber(longestSilenceMs) &&
    isNumber(nudgeCount) &&
    isNumber(hintCount) &&
    Array.isArray(answers) &&
    answers.every(
      (answer) => typeof answer === "object" && answer !== null && isNumber(answer.durationMs) && typeof answer.overBudget === "boolean",
    )
  );
}

function parseScoringRequest(value: unknown): ScoringRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const { transcript, level, competencies, metrics } = value as Record<string, unknown>;
  if (!Array.isArray(transcript) || !transcript.every(isTranscriptEntry)) return null;
  if (!isOneOf(LEVELS, level)) return null;
  if (!Array.isArray(competencies) || competencies.length === 0) return null;
  if (!competencies.every((competency): competency is Competency => isOneOf(COMPETENCIES, competency))) return null;
  if (!isMetrics(metrics)) return null;
  return { transcript, level, competencies, metrics };
}

const seconds = (ms: number) => Math.round(ms / 1000);

function metricFacts({ longestSilenceMs, answers, nudgeCount, hintCount }: CommunicationMetrics): string[] {
  return [
    `Longest silence: ${seconds(longestSilenceMs)} seconds`,
    `Answers over their time budget: ${answers.filter(({ overBudget }) => overBudget).length} of ${answers.length}`,
    `Nudges: ${nudgeCount}`,
    `Hints used: ${hintCount}`,
  ];
}

function rubricText(competency: Competency, level: ScoringRequest["level"]): string[] {
  const { measures, anchors, levelLine } = rubricFor(competency, level);
  return [
    `Competency: ${competency}`,
    `Measures: ${measures}`,
    ...anchors.map(({ score, description }) => `${score}: ${description}`),
    `At ${level} level, a 3 looks like: ${levelLine}`,
  ];
}

const OUTPUT_FORMAT = JSON.stringify({
  scores: [{ competency: "ownership", value: 3, evidence: ["exact words the candidate said"] }],
  weaknesses: [{ competency: "ownership", answerQuote: "exact words the candidate said", rewrite: "a stronger version of that answer" }],
});

function instructionsFor({ level, metrics }: ScoringRequest, toScore: Competency[], isRetry: boolean): string {
  return [
    "You score a behavioral interview against a rubric. Be rigorous and do not flatter the candidate.",
    `Candidate level: ${level}. Every score is relative to this level: 3 is competent for it, 4 is strong for it.`,
    ...(isRetry
      ? [
          `Score only these competencies: ${toScore.join(", ")}.`,
          "A previous attempt left them without a quote that appears word for word in the transcript.",
        ]
      : []),
    "Score each competency from 1 to 5 using only what the candidate said. If they answered but showed no usable evidence of the skill, score 1.",
    "Every score needs at least one quote in evidence. Copy the candidate's words exactly from a single candidate turn, at least 4 words long. A score without an exact quote is discarded.",
    "",
    ...toScore.flatMap((competency) => [...rubricText(competency, level), ""]),
    "Facts about how the candidate spoke. They are computed, so do not restate or change them:",
    ...metricFacts(metrics),
    "",
    "Also pick up to 3 weaknesses. For each, quote one answer the candidate actually gave in answerQuote, exactly as said, and write a stronger version in rewrite.",
    "Use only facts the candidate gave. Where a stronger answer needs detail they did not give, write [your detail here].",
    "",
    `Reply with only JSON in this shape: ${OUTPUT_FORMAT}`,
  ].join("\n");
}

function transcriptMessage({ transcript }: ScoringRequest) {
  const lines = transcript.map(({ speaker, body }) => `${speaker === "candidate" ? "Candidate" : "Interviewer"}: ${body}`);
  return { role: "user" as const, content: lines.join("\n\n") };
}

type ModelScoring = { scores: ProposedScore[]; weaknesses: ProposedWeakness[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function readScore(value: unknown): ProposedScore | null {
  if (!isRecord(value)) return null;
  const { competency, value: score, evidence } = value;
  if (!isOneOf(COMPETENCIES, competency) || !isNumber(score)) return null;
  if (!Array.isArray(evidence) || !evidence.every((quote) => typeof quote === "string")) return null;
  return { competency, value: score, evidence };
}

function readWeakness(value: unknown): ProposedWeakness | null {
  if (!isRecord(value)) return null;
  const { competency, answerQuote, rewrite } = value;
  if (!isOneOf(COMPETENCIES, competency) || typeof answerQuote !== "string" || typeof rewrite !== "string") return null;
  return { competency, answerQuote, rewrite };
}

const keep = <T>(items: (T | null)[]): T[] => items.filter((item): item is T => item !== null);

// Models wrap JSON in fences or add a sentence around it, so read from the first brace to the last.
function readModelScoring(reply: string): ModelScoring {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end < start) return { scores: [], weaknesses: [] };
  try {
    const parsed: unknown = JSON.parse(reply.slice(start, end + 1));
    if (!isRecord(parsed)) return { scores: [], weaknesses: [] };
    const { scores, weaknesses } = parsed;
    return {
      scores: Array.isArray(scores) ? keep(scores.map(readScore)) : [],
      weaknesses: Array.isArray(weaknesses) ? keep(weaknesses.map(readWeakness)) : [],
    };
  } catch {
    return { scores: [], weaknesses: [] };
  }
}

export function createScoringHandler(generate: GenerateReply) {
  const ask = async (request: ScoringRequest, toScore: Competency[], isRetry: boolean) =>
    readModelScoring(
      await generate({ instructions: instructionsFor(request, toScore, isRetry), messages: [transcriptMessage(request)] }),
    );

  return async function handleScoring(httpRequest: Request): Promise<Response> {
    const body: unknown = await httpRequest.json().catch(() => null);
    const request = parseScoringRequest(body);
    if (!request) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
      const { transcript, competencies } = request;
      const first = await ask(request, competencies, false);
      let verified = verifyScores({ proposed: first.scores, transcript, competencies });
      let weaknesses = first.weaknesses;

      if (verified.notScored.length > 0) {
        // A failed retry must not throw away what the first call already proved.
        const retry = await ask(request, verified.notScored, true).catch(() => ({ scores: [], weaknesses: [] }));
        verified = verifyScores({ proposed: [...first.scores, ...retry.scores], transcript, competencies });
        weaknesses = [...first.weaknesses, ...retry.weaknesses];
      }

      if (verified.scores.length === 0) {
        return Response.json({ error: "No score could be verified", code: "unscorable" }, { status: 502 });
      }
      const result: ScoringResponse = { ...verified, weaknesses };
      return Response.json(result);
    } catch (error) {
      // Error text can echo the prompt, so log only the error type.
      console.error("scoring failed", error instanceof Error ? error.name : "unknown");
      return Response.json({ error: "Model call failed" }, { status: 502 });
    }
  };
}

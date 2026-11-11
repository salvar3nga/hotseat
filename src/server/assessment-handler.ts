import { COMPETENCIES, isOneOf } from "../engine/types";
import type { AssessmentRequest, Competency } from "../engine/types";
import { isTranscriptEntry, toMessages } from "./turn-handler";
import type { GenerateReply } from "./turn-handler";

function parseAssessmentRequest(value: unknown): AssessmentRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const { competency, transcript } = value as Record<string, unknown>;
  if (!isOneOf(COMPETENCIES, competency)) return null;
  if (!Array.isArray(transcript) || !transcript.every(isTranscriptEntry)) return null;
  return { competency, transcript };
}

function instructionsFor(competency: Competency): string {
  return [
    "You assess one answer in a behavioral interview. Use the STAR signals: situation, task, action, result.",
    `Competency: ${competency}.`,
    "Is at least one STAR signal missing or too vague in the candidate's last answer?",
    "Reply with only yes or no.",
  ].join("\n");
}

export function createAssessmentHandler(generate: GenerateReply) {
  return async function handleAssessment(request: Request): Promise<Response> {
    const body: unknown = await request.json().catch(() => null);
    const assessment = parseAssessmentRequest(body);
    if (!assessment) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
      const reply = await generate({
        instructions: instructionsFor(assessment.competency),
        messages: toMessages(assessment.transcript),
      });
      return Response.json({ missingSignal: /^\s*yes\b/i.test(reply) });
    } catch (error) {
      // Error text can echo the prompt, so log only the error type.
      console.error("answer assessment failed", error instanceof Error ? error.name : "unknown");
      return Response.json({ error: "Model call failed" }, { status: 502 });
    }
  };
}

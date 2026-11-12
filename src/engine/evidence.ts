import type { Score } from "./ports";
import type { Competency, TranscriptEntry } from "./types";
import { MAX_COMPETENCY_SCORE, MIN_COMPETENCY_SCORE } from "./verdict";

export const MIN_QUOTE_WORDS = 4;

// Model output is untrusted, so the value and the quotes are checked here, not assumed.
export type ProposedScore = { competency: Competency; value: number; evidence: string[] };

export type VerifiedScores = { scores: Score[]; notScored: Competency[] };

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

const isScoreValue = (value: number) =>
  Number.isInteger(value) && value >= MIN_COMPETENCY_SCORE && value <= MAX_COMPETENCY_SCORE;

export function verifyScores({
  proposed,
  transcript,
  competencies,
}: {
  proposed: ProposedScore[];
  transcript: TranscriptEntry[];
  competencies: Competency[];
}): VerifiedScores {
  const candidateTurns = transcript.filter(({ speaker }) => speaker === "candidate").map(({ body }) => normalize(body));

  const isVerbatimQuote = (quote: string) => {
    const normalized = normalize(quote);
    return (
      normalized.split(" ").length >= MIN_QUOTE_WORDS && candidateTurns.some((turn) => turn.includes(normalized))
    );
  };

  const verify = (competency: Competency): Score | null => {
    for (const candidate of proposed.filter((score) => score.competency === competency)) {
      const evidence = candidate.evidence.filter(isVerbatimQuote);
      if (isScoreValue(candidate.value) && evidence.length > 0) {
        return { competency, value: candidate.value, evidence };
      }
    }
    return null;
  };

  const verified = competencies.map((competency) => ({ competency, score: verify(competency) }));
  return {
    scores: verified.flatMap(({ score }) => (score ? [score] : [])),
    notScored: verified.filter(({ score }) => !score).map(({ competency }) => competency),
  };
}

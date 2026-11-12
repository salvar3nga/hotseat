import type { CommunicationMetrics } from "./communication-metrics";
import { quoteVerifier } from "./evidence";
import type { VerifiedScores } from "./evidence";
import type { Level, Score } from "./ports";
import { COMPETENCIES } from "./types";
import type { Competency, InterviewerStyle, SessionState, TranscriptEntry } from "./types";

export const MAX_WEAKNESSES = 3;
export const MAX_DRILL_WEAKNESSES = 1;
export const MAX_PRACTICE_ITEMS = 3;

// answerQuote is the candidate's own answer that the rewrite improves on.
export type ProposedWeakness = { competency: Competency; answerQuote: string; rewrite: string };

export type Weakness = ProposedWeakness;

export type PracticeItem = { competency: Competency; level: Level; style: InterviewerStyle };

export type Debrief = {
  scores: Score[];
  notScored: Competency[];
  weaknesses: Weakness[];
  practicePlan: PracticeItem[];
  metrics: CommunicationMetrics;
  partial: boolean;
};

export type ScoringRequest = {
  transcript: TranscriptEntry[];
  level: Level;
  competencies: Competency[];
  metrics: CommunicationMetrics;
};

// Weaknesses are still proposals here. assembleDebrief checks them against the verified scores.
export type ScoringResponse = VerifiedScores & { weaknesses: ProposedWeakness[] };

type SessionFacts = Pick<SessionState, "mode" | "level" | "style">;

const byScoreAscending = (scores: Score[]) => (a: Competency, b: Competency) => {
  const valueOf = (competency: Competency) => scores.find((score) => score.competency === competency)!.value;
  return valueOf(a) - valueOf(b);
};

function validWeaknesses(
  proposed: ProposedWeakness[],
  { scores }: VerifiedScores,
  transcript: TranscriptEntry[],
  limit: number,
): Weakness[] {
  const isRealAnswer = quoteVerifier(transcript);
  const scoredCompetencies = scores.map(({ competency }) => competency);
  const rank = byScoreAscending(scores);

  const usable = proposed.filter(
    ({ competency, answerQuote, rewrite }) =>
      scoredCompetencies.includes(competency) && rewrite.trim() !== "" && isRealAnswer(answerQuote),
  );
  const onePerCompetency = usable.filter(
    ({ competency }, index) => usable.findIndex((other) => other.competency === competency) === index,
  );
  return onePerCompetency.sort((a, b) => rank(a.competency, b.competency)).slice(0, limit);
}

// Scored competencies from weakest up, then ones that could not be scored, then ones the session never asked about.
function practiceCompetencies({ scores, notScored }: VerifiedScores): Competency[] {
  const scored = scores.map(({ competency }) => competency).sort(byScoreAscending(scores));
  const unasked = COMPETENCIES.filter((competency) => !scored.includes(competency) && !notScored.includes(competency));
  return [...scored, ...notScored, ...unasked].slice(0, MAX_PRACTICE_ITEMS);
}

export function assembleDebrief({
  verified,
  proposedWeaknesses,
  transcript,
  session: { mode, level, style },
  metrics,
  partial,
}: {
  verified: VerifiedScores;
  proposedWeaknesses: ProposedWeakness[];
  transcript: TranscriptEntry[];
  session: SessionFacts;
  metrics: CommunicationMetrics;
  partial: boolean;
}): Debrief {
  const weaknessLimit = mode === "drill" ? MAX_DRILL_WEAKNESSES : MAX_WEAKNESSES;
  return {
    scores: verified.scores,
    notScored: verified.notScored,
    weaknesses: validWeaknesses(proposedWeaknesses, verified, transcript, weaknessLimit),
    practicePlan: practiceCompetencies(verified).map((competency) => ({ competency, level, style })),
    metrics,
    partial,
  };
}

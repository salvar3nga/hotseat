import type { Turn } from "./types";

export type AnswerMetrics = { durationMs: number; overBudget: boolean };

export type CommunicationMetrics = {
  longestSilenceMs: number;
  answers: AnswerMetrics[];
  nudgeCount: number;
  hintCount: number;
};

// Facts only, computed from the turn timestamps: no model call and no real clock.
export function communicationMetrics(turns: Turn[], answerBudgetMs: number | null): CommunicationMetrics | null {
  const answers = turns.filter(({ kind }) => kind === "answer");
  if (answers.length === 0) return null;

  const interviewerEnds = turns.filter(({ speaker }) => speaker === "interviewer").map(({ endedAt }) => endedAt);
  const silenceBefore = ({ startedAt }: Turn) => {
    const lastHeard = Math.max(...interviewerEnds.filter((endedAt) => endedAt <= startedAt));
    return Number.isFinite(lastHeard) ? startedAt - lastHeard : 0;
  };

  return {
    longestSilenceMs: Math.max(...answers.map(silenceBefore)),
    answers: answers.map(({ startedAt, endedAt }) => {
      const durationMs = endedAt - startedAt;
      return { durationMs, overBudget: answerBudgetMs !== null && durationMs > answerBudgetMs };
    }),
    nudgeCount: turns.filter(({ kind }) => kind === "nudge").length,
    hintCount: turns.filter(({ kind }) => kind === "hint").length,
  };
}

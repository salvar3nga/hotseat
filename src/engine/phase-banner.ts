import { isOneOf } from "./types";
import type { SessionState } from "./types";

const PHASES = ["warm-up", "question", "follow-up", "wrap-up"] as const;

type Phase = (typeof PHASES)[number];

export const PHASE_BANNER_COPY: Record<Phase, string> = {
  "warm-up": "Warm-up: a short, casual answer is fine. It isn't scored.",
  question: "Give one real example: the situation, your task, what you did, and the result.",
  "follow-up": "The interviewer is probing a gap. Be specific about what you did and what happened.",
  "wrap-up": "The interviewer is closing the session. There are no more questions.",
};

// While an answer or a hint is pending, the phase is whatever the interviewer last asked.
function phaseOf(state: SessionState): Phase | null {
  if (state.status !== "in-progress") return null;
  if (isOneOf(PHASES, state.awaiting)) return state.awaiting;
  const lastAsked = state.turns.findLast(
    ({ speaker, kind }) => speaker === "interviewer" && isOneOf(PHASES, kind),
  );
  return lastAsked && isOneOf(PHASES, lastAsked.kind) ? lastAsked.kind : null;
}

export function phaseBanner(state: SessionState): string | null {
  const phase = phaseOf(state);
  return state.showsBanner && phase ? PHASE_BANNER_COPY[phase] : null;
}

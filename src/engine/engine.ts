import { COMPETENCIES } from "./types";
import type {
  Competency,
  Event,
  SessionConfig,
  SessionState,
  StepResult,
  Turn,
  TurnKind,
} from "./types";

// mulberry32: tiny deterministic PRNG so a stored seed reproduces the plan
function seededUnitInterval(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createSession({ mode, seed }: SessionConfig): SessionState {
  const pick = Math.floor(seededUnitInterval(seed) * COMPETENCIES.length);
  return {
    mode,
    status: "configured",
    seed,
    plan: [COMPETENCIES[pick]],
    turns: [],
    awaiting: null,
  };
}

function interviewerTurn(
  kind: TurnKind,
  body: string,
  now: number,
  competency: Competency,
): Turn {
  return { speaker: "interviewer", body, kind, startedAt: now, endedAt: now, competency };
}

export function step(state: SessionState, event: Event): StepResult {
  const ignored: StepResult = { state, effects: [] };
  const competency = state.plan[0];

  switch (event.type) {
    case "start":
      if (state.status !== "configured") return ignored;
      return {
        state: { ...state, status: "in-progress", awaiting: "question" },
        effects: [{ type: "generateTurn", kind: "question", competency }],
      };
    case "modelReply": {
      if (state.awaiting !== "question" && state.awaiting !== "wrap-up") return ignored;
      const turns = [
        ...state.turns,
        interviewerTurn(state.awaiting, event.text, event.now, competency),
      ];
      return state.awaiting === "wrap-up"
        ? { state: { ...state, turns, status: "completed", awaiting: null }, effects: [] }
        : { state: { ...state, turns, awaiting: "answer" }, effects: [] };
    }
    case "candidateTurn": {
      if (state.awaiting !== "answer") return ignored;
      const turn: Turn = {
        speaker: "candidate",
        body: event.text,
        kind: "answer",
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        competency,
      };
      return {
        state: { ...state, turns: [...state.turns, turn], awaiting: "wrap-up" },
        effects: [{ type: "generateTurn", kind: "wrap-up", competency }],
      };
    }
  }
}

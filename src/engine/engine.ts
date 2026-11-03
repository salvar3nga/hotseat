import type {
  Competency,
  Effect,
  Event,
  SessionConfig,
  SessionState,
  Turn,
} from "./types";

const COMPETENCIES: Competency[] = ["ownership", "conflict", "ambiguity", "failure"];

// mulberry32: tiny deterministic PRNG so a stored seed reproduces the plan
function seededUnitInterval(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createSession({ seed }: SessionConfig): SessionState {
  const pick = Math.floor(seededUnitInterval(seed) * COMPETENCIES.length);
  return {
    status: "configured",
    seed,
    plan: [COMPETENCIES[pick]],
    turns: [],
    awaiting: null,
  };
}

type StepResult = { state: SessionState; effects: Effect[] };

export function step(state: SessionState, event: Event): StepResult {
  const competency = state.plan[0];

  switch (event.type) {
    case "start":
      return {
        state: { ...state, status: "in-progress", awaiting: "question" },
        effects: [{ type: "generateTurn", kind: "question", competency }],
      };
    case "modelReply": {
      const kind = state.awaiting === "wrap-up" ? "wrap-up" : "question";
      const turn: Turn = {
        speaker: "interviewer",
        body: event.text,
        kind,
        startedAt: event.now,
        endedAt: event.now,
        competency,
      };
      const turns = [...state.turns, turn];
      return kind === "wrap-up"
        ? { state: { ...state, turns, status: "completed", awaiting: null }, effects: [] }
        : { state: { ...state, turns, awaiting: "answer" }, effects: [] };
    }
    case "candidateTurn": {
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

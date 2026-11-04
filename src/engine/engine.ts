import { COMPETENCIES, DEFAULT_ENGINE_CONFIG, GENERATED_KINDS, isOneOf } from "./types";
import type {
  Competency,
  Effect,
  EngineConfig,
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

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededUnitInterval(seed + i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function planFor(config: SessionConfig, { mockCompetencyCounts }: EngineConfig): Competency[] {
  if (config.mode === "drill") {
    return [COMPETENCIES[Math.floor(seededUnitInterval(config.seed) * COMPETENCIES.length)]];
  }
  return seededShuffle(COMPETENCIES, config.seed).slice(
    0,
    mockCompetencyCounts[config.durationMinutes],
  );
}

export function createSession(
  config: SessionConfig,
  engineConfig: EngineConfig = DEFAULT_ENGINE_CONFIG,
): SessionState {
  return {
    mode: config.mode,
    status: "configured",
    seed: config.seed,
    plan: planFor(config, engineConfig),
    warmUpMinutes: config.mode === "mock" ? engineConfig.warmUpMinutes : null,
    turns: [],
    awaiting: null,
  };
}

function competencyFor(kind: TurnKind, plan: Competency[]): Competency | null {
  return kind === "warm-up" || kind === "warm-up-skip" ? null : plan[0];
}

function turn(
  speaker: Turn["speaker"],
  kind: TurnKind,
  body: string,
  startedAt: number,
  endedAt: number,
  plan: Competency[],
): Turn {
  return { speaker, body, kind, startedAt, endedAt, competency: competencyFor(kind, plan) };
}

function generateTurn(kind: Effect["kind"], plan: Competency[]): Effect {
  return { type: "generateTurn", kind, competency: competencyFor(kind, plan) };
}

function isAnsweringWarmUp(state: SessionState): boolean {
  return state.awaiting === "answer" && state.turns.at(-1)?.kind === "warm-up";
}

function afterWarmUp(state: SessionState, warmUpReply: Turn): StepResult {
  return {
    state: { ...state, turns: [...state.turns, warmUpReply], awaiting: "question" },
    effects: [generateTurn("question", state.plan)],
  };
}

export function step(state: SessionState, event: Event): StepResult {
  const ignored: StepResult = { state, effects: [] };

  switch (event.type) {
    case "start": {
      if (state.status !== "configured") return ignored;
      const firstKind = state.mode === "mock" ? "warm-up" : "question";
      return {
        state: { ...state, status: "in-progress", awaiting: firstKind },
        effects: [generateTurn(firstKind, state.plan)],
      };
    }
    case "modelReply": {
      if (!isOneOf(GENERATED_KINDS, state.awaiting)) return ignored;
      const turns = [
        ...state.turns,
        turn("interviewer", state.awaiting, event.text, event.now, event.now, state.plan),
      ];
      return state.awaiting === "wrap-up"
        ? { state: { ...state, turns, status: "completed", awaiting: null }, effects: [] }
        : { state: { ...state, turns, awaiting: "answer" }, effects: [] };
    }
    case "skipWarmUp":
      if (!isAnsweringWarmUp(state)) return ignored;
      return afterWarmUp(
        state,
        turn("candidate", "warm-up-skip", "", event.now, event.now, state.plan),
      );
    case "candidateTurn": {
      if (state.awaiting !== "answer") return ignored;
      const kind = isAnsweringWarmUp(state) ? "warm-up" : "answer";
      const answer = turn("candidate", kind, event.text, event.startedAt, event.endedAt, state.plan);
      if (kind === "warm-up") return afterWarmUp(state, answer);
      return {
        state: { ...state, turns: [...state.turns, answer], awaiting: "wrap-up" },
        effects: [generateTurn("wrap-up", state.plan)],
      };
    }
  }
}

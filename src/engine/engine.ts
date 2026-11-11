import { COMPETENCIES, DEFAULT_ENGINE_CONFIG, GENERATED_KINDS, isOneOf } from "./types";
import type {
  Competency,
  GenerateTurnEffect,
  EngineConfig,
  Event,
  SessionClock,
  SessionConfig,
  SessionState,
  StepResult,
  TranscriptEntry,
  Turn,
  TurnKind,
} from "./types";

const MS_PER_MINUTE = 60_000;

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
  if (config.mode === "coding") return [];
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
    followUpCap: engineConfig.followUpCap,
    nudgeBudgetMs: config.mode === "coding" ? null : engineConfig.nudgeMinutes[config.mode] * MS_PER_MINUTE,
    questionIndex: 0,
    followUpsAsked: 0,
    turns: [],
    awaiting: null,
    clock: {
      scope: config.mode === "coding" ? "question" : "session",
      budgetMs: budgetMinutes(config, engineConfig) * MS_PER_MINUTE,
      elapsedMs: 0,
      answerElapsedMs: 0,
      runningSince: null,
    },
    tabHidden: false,
    nudge: "idle",
    overruns: [],
  };
}

function budgetMinutes(config: SessionConfig, engineConfig: EngineConfig): number {
  switch (config.mode) {
    case "mock":
      return config.durationMinutes;
    case "drill":
      return engineConfig.drillMinutes;
    case "coding":
      return engineConfig.codingMinutes;
  }
}

// The clock only runs while the candidate can answer in a visible tab, so model waits
// and time away from the tab never count.
function isClockRunning(state: SessionState): boolean {
  return state.status === "in-progress" && state.awaiting === "answer" && !state.tabHidden;
}

function runningMsAt(clock: SessionClock, now: number): number {
  return clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince);
}

function elapsedAt(clock: SessionClock, now: number): number {
  return clock.elapsedMs + runningMsAt(clock, now);
}

function answerElapsedAt(clock: SessionClock, now: number): number {
  return clock.answerElapsedMs + runningMsAt(clock, now);
}

export function remainingMs(state: SessionState, now: number): number {
  return Math.max(0, state.clock.budgetMs - elapsedAt(state.clock, now));
}

// Zero is only ever reached mid-answer, so it is checked when that answer ends.
// A per-question clock never ends the session: the answer is accepted and the overrun recorded.
function isExpiredAt(state: SessionState, now: number): boolean {
  return state.clock.scope === "session" && remainingMs(state, now) === 0;
}

function withOverrun(state: SessionState, now: number): SessionState {
  const overrunMs = elapsedAt(state.clock, now) - state.clock.budgetMs;
  if (state.clock.scope === "session" || overrunMs <= 0) return state;
  const otherQuestions = state.overruns.filter(({ questionIndex }) => questionIndex !== state.questionIndex);
  return { ...state, overruns: [...otherQuestions, { questionIndex: state.questionIndex, overrunMs }] };
}

function reclock(previous: SessionState, next: SessionState, now: number): SessionState {
  const startsNewAnswer = next.awaiting === "answer" && previous.awaiting !== "answer";
  const startsNewQuestion = next.clock.scope === "question" && next.questionIndex !== previous.questionIndex;
  const clock = {
    ...next.clock,
    elapsedMs: startsNewQuestion ? 0 : elapsedAt(previous.clock, now),
    answerElapsedMs: startsNewAnswer ? 0 : answerElapsedAt(previous.clock, now),
    runningSince: isClockRunning(next) ? now : null,
  };
  return { ...next, clock };
}

function eventTime(event: Event): number {
  return event.type === "candidateTurn" ? event.endedAt : event.now;
}

function competencyFor(kind: TurnKind, state: SessionState): Competency | null {
  return kind === "warm-up" || kind === "warm-up-skip" ? null : (state.plan[state.questionIndex] ?? null);
}

function turn(
  speaker: Turn["speaker"],
  kind: TurnKind,
  body: string,
  startedAt: number,
  endedAt: number,
  state: SessionState,
): Turn {
  return { speaker, body, kind, startedAt, endedAt, competency: competencyFor(kind, state) };
}

function generateTurn(kind: GenerateTurnEffect["kind"], state: SessionState): GenerateTurnEffect {
  return { type: "generateTurn", kind, competency: competencyFor(kind, state) };
}

function moveTo(
  state: SessionState,
  kind: GenerateTurnEffect["kind"],
  progress: Partial<Pick<SessionState, "questionIndex" | "followUpsAsked">> = {},
): StepResult {
  const next = { ...state, ...progress, awaiting: kind };
  return { state: next, effects: [generateTurn(kind, next)] };
}

export function isAnsweringWarmUp(state: SessionState): boolean {
  return state.awaiting === "answer" && state.turns.at(-1)?.kind === "warm-up";
}

export function currentQuestionTranscript(state: SessionState): TranscriptEntry[] {
  const questionIndex = state.turns.findLastIndex(({ kind }) => kind === "question");
  return state.turns.slice(questionIndex).map(({ speaker, body }) => ({ speaker, body }));
}

function hasScoredAnswer(state: SessionState): boolean {
  return state.turns.some(({ kind }) => kind === "answer");
}

function canNudge(state: SessionState): boolean {
  return (
    state.status === "in-progress" &&
    state.awaiting === "answer" &&
    state.nudge === "idle" &&
    !isAnsweringWarmUp(state)
  );
}

function afterWarmUp(state: SessionState, warmUpReply: Turn, now: number): StepResult {
  const answered = { ...state, turns: [...state.turns, warmUpReply] };
  return isExpiredAt(state, now) ? moveTo(answered, "wrap-up") : moveTo(answered, "question");
}

export function step(state: SessionState, event: Event): StepResult {
  const result = transition(state, event);
  if (result.state === state) return result;
  return { ...result, state: reclock(state, result.state, eventTime(event)) };
}

function transition(state: SessionState, event: Event): StepResult {
  const ignored: StepResult = { state, effects: [] };

  switch (event.type) {
    case "start": {
      if (state.status !== "configured") return ignored;
      const firstKind = state.mode === "mock" ? "warm-up" : "question";
      return {
        state: { ...state, status: "in-progress", awaiting: firstKind },
        effects: [generateTurn(firstKind, state)],
      };
    }
    case "modelReply": {
      if (!isOneOf(GENERATED_KINDS, state.awaiting)) return ignored;
      const turns = [
        ...state.turns,
        turn("interviewer", state.awaiting, event.text, event.now, event.now, state),
      ];
      return state.awaiting === "wrap-up"
        ? { state: { ...state, turns, status: "completed", awaiting: null }, effects: [] }
        : { state: { ...state, turns, awaiting: "answer", nudge: "idle" }, effects: [] };
    }
    case "stop": {
      if (state.status !== "in-progress") return ignored;
      const stopped = { ...state, awaiting: null };
      return hasScoredAnswer(state)
        ? {
            state: { ...stopped, status: "completed" },
            effects: [{ type: "buildDebrief", transcript: state.turns.map(({ speaker, body }) => ({ speaker, body })) }],
          }
        : { state: { ...stopped, status: "abandoned" }, effects: [] };
    }
    case "tick": {
      const overBudget =
        state.nudgeBudgetMs !== null && answerElapsedAt(state.clock, event.now) >= state.nudgeBudgetMs;
      if (!canNudge(state) || !overBudget) return ignored;
      return {
        state: { ...state, nudge: "requested" },
        effects: [generateTurn("nudge", state)],
      };
    }
    case "nudgeReply": {
      if (state.awaiting !== "answer" || state.nudge !== "requested") return ignored;
      const nudgeTurn = turn("interviewer", "nudge", event.text, event.now, event.now, state);
      return { state: { ...state, turns: [...state.turns, nudgeTurn], nudge: "sent" }, effects: [] };
    }
    case "skipWarmUp":
      if (!isAnsweringWarmUp(state)) return ignored;
      return afterWarmUp(
        state,
        turn("candidate", "warm-up-skip", "", event.now, event.now, state),
        event.now,
      );
    case "tabHidden":
      return state.tabHidden ? ignored : { state: { ...state, tabHidden: true }, effects: [] };
    case "tabVisible":
      return state.tabHidden ? { state: { ...state, tabHidden: false }, effects: [] } : ignored;
    case "candidateTurn": {
      if (state.awaiting !== "answer") return ignored;
      const kind = isAnsweringWarmUp(state) ? "warm-up" : "answer";
      const answer = turn("candidate", kind, event.text, event.startedAt, event.endedAt, state);
      if (kind === "warm-up") return afterWarmUp(state, answer, event.endedAt);
      const answered = withOverrun({ ...state, turns: [...state.turns, answer] }, event.endedAt);
      if (isExpiredAt(state, event.endedAt)) return moveTo(answered, "wrap-up");
      if (event.missingSignal && state.followUpsAsked < state.followUpCap) {
        return moveTo(answered, "follow-up", { followUpsAsked: state.followUpsAsked + 1 });
      }
      const hasNextQuestion = state.questionIndex + 1 < state.plan.length;
      return hasNextQuestion
        ? moveTo(answered, "question", { questionIndex: state.questionIndex + 1, followUpsAsked: 0 })
        : moveTo(answered, "wrap-up");
    }
  }
}

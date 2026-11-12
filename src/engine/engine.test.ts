import { describe, expect, it } from "vitest";
import {
  answerRemainingMs,
  createSession,
  currentQuestionTranscript,
  hintsRemaining,
  hintsUsed,
  remainingMs,
  step,
} from "./engine";
import { DEFAULT_ENGINE_CONFIG } from "./types";
import type { Effect, EngineConfig, Event, GenerateTurnEffect, InterviewerStyle, SessionConfig, SessionState, StyleSettings, Turn } from "./types";

describe("createSession", () => {
  it("records the level it was configured with", () => {
    expect(createSession({ mode: "drill", seed: 7, level: "senior" }).level).toBe("senior");
  });

  it("starts configured", () => {
    expect(createSession({ mode: "drill", seed: 7, level: "mid" }).status).toBe("configured");
  });

  it("plans one competency for a drill", () => {
    expect(createSession({ mode: "drill", seed: 7, level: "mid" }).plan).toEqual(["ownership"]);
  });

  it("plans a different competency for a different seed", () => {
    expect(createSession({ mode: "drill", seed: 4, level: "mid" }).plan).toEqual(["communication"]);
  });

  it("keeps the mode it was configured with", () => {
    expect(createSession({ mode: "drill", seed: 7, level: "mid" }).mode).toBe("drill");
  });
});

describe("createSession in mock mode", () => {
  const mock = (durationMinutes: 30 | 45, seed = 7) =>
    createSession({ mode: "mock", durationMinutes, seed, level: "mid" });

  it("plans 4 competencies at 30 minutes and 6 at 45", () => {
    expect(mock(30).plan).toHaveLength(4);
    expect(mock(45).plan).toHaveLength(6);
  });

  it("plans distinct competencies", () => {
    expect(new Set(mock(45).plan).size).toBe(6);
  });

  it("gives the same plan for the same seed and a different one for another seed", () => {
    expect(mock(30, 7).plan).toEqual(mock(30, 7).plan);
    expect(mock(30, 7).plan).not.toEqual(mock(30, 8).plan);
  });

  it("takes counts and warm-up length from config", () => {
    const config = { ...DEFAULT_ENGINE_CONFIG, mockCompetencyCounts: { 30: 2, 45: 3 }, warmUpMinutes: 5 };
    const session = createSession({ mode: "mock", durationMinutes: 45, seed: 7, level: "mid" }, config);

    expect(session.plan).toHaveLength(3);
    expect(session.warmUpMinutes).toBe(5);
  });

  it("defaults to a 3 minute warm-up, and a drill has none", () => {
    expect(mock(30).warmUpMinutes).toBe(3);
    expect(createSession({ mode: "drill", seed: 7, level: "mid" }).warmUpMinutes).toBeNull();
  });
});

function playEvents(initial: SessionState, events: Event[]) {
  return events.reduce(
    (played, event) => {
      const result = step(played.state, event);
      return { state: result.state, effects: [...played.effects, ...result.effects] };
    },
    { state: initial, effects: [] as Effect[] },
  );
}

const drill = () => createSession({ mode: "drill", seed: 7, level: "mid" });

const standardStyleWith = (overrides: Partial<StyleSettings>): EngineConfig => ({
  ...DEFAULT_ENGINE_CONFIG,
  styles: {
    ...DEFAULT_ENGINE_CONFIG.styles,
    standard: { ...DEFAULT_ENGINE_CONFIG.styles.standard, ...overrides },
  },
});

const scriptedDrill: Event[] = [
  { type: "start", now: 1_000 },
  { type: "modelReply", text: "Tell me about a time you owned a project.", now: 2_000 },
  { type: "candidateTurn", text: "I led the migration.", startedAt: 3_000, endedAt: 60_000 },
  { type: "modelReply", text: "Thanks, that is all.", now: 61_000 },
];

describe("a scripted drill", () => {
  it("moves from configured to completed", () => {
    expect(playEvents(drill(), scriptedDrill).state.status).toBe("completed");
  });

  it("records the interviewer question", () => {
    expect(playEvents(drill(), scriptedDrill).state.turns[0]).toEqual({
      speaker: "interviewer",
      body: "Tell me about a time you owned a project.",
      kind: "question",
      startedAt: 2_000,
      endedAt: 2_000,
      competency: "ownership",
    });
  });

  it("records the candidate answer with its own start and end", () => {
    expect(playEvents(drill(), scriptedDrill).state.turns[1]).toEqual({
      speaker: "candidate",
      body: "I led the migration.",
      kind: "answer",
      startedAt: 3_000,
      endedAt: 60_000,
      competency: "ownership",
    });
  });

  it("records the interviewer wrap-up", () => {
    expect(playEvents(drill(), scriptedDrill).state.turns[2]).toEqual({
      speaker: "interviewer",
      body: "Thanks, that is all.",
      kind: "wrap-up",
      startedAt: 61_000,
      endedAt: 61_000,
      competency: "ownership",
    });
  });

  it("asks for a question, then a wrap-up", () => {
    expect(playEvents(drill(), scriptedDrill).effects).toEqual([
      { type: "generateTurn", kind: "question", competency: "ownership" },
      { type: "generateTurn", kind: "wrap-up", competency: "ownership" },
    ]);
  });
});

describe("events that do not fit the current state", () => {
  it("ignores a model reply before the session starts", () => {
    const initial = drill();
    const result = step(initial, { type: "modelReply", text: "Hi", now: 1_000 });

    expect(result).toEqual({ state: initial, effects: [] });
  });

  it("ignores a candidate turn while the interviewer is expected to speak", () => {
    const started = playEvents(drill(), [{ type: "start", now: 1_000 }]).state;
    const result = step(started, { type: "candidateTurn", text: "Hi", startedAt: 1, endedAt: 2 });

    expect(result).toEqual({ state: started, effects: [] });
  });

  it("ignores every event once the session is completed", () => {
    const completed = playEvents(drill(), scriptedDrill).state;
    const result = step(completed, { type: "start", now: 99_000 });

    expect(result).toEqual({ state: completed, effects: [] });
  });
});

describe("a mock warm-up", () => {
  const warmUpAsked: Event[] = [
    { type: "start", now: 1_000 },
    { type: "modelReply", text: "How has your week been?", now: 2_000 },
  ];
  const mockSession = () => createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" });
  const [firstCompetency] = mockSession().plan;

  it("opens with a warm-up request that has no competency", () => {
    expect(playEvents(mockSession(), [{ type: "start", now: 1_000 }]).effects).toEqual([
      { type: "generateTurn", kind: "warm-up", competency: null },
    ]);
  });

  it("asks the first planned question after the warm-up is answered", () => {
    const played = playEvents(mockSession(), [
      ...warmUpAsked,
      { type: "candidateTurn", text: "Busy but good.", startedAt: 3_000, endedAt: 9_000 },
    ]);

    expect(played.effects.at(-1)).toEqual({
      type: "generateTurn",
      kind: "question",
      competency: firstCompetency,
    });
  });

  it("records a skip as its own turn kind, then asks the first question", () => {
    const played = playEvents(mockSession(), [...warmUpAsked, { type: "skipWarmUp", now: 4_000 }]);

    expect(played.state.turns[1]).toEqual({
      speaker: "candidate",
      body: "",
      kind: "warm-up-skip",
      startedAt: 4_000,
      endedAt: 4_000,
      competency: null,
    });
    expect(played.effects.at(-1)).toMatchObject({ kind: "question", competency: firstCompetency });
  });

  it("ignores a skip once the warm-up is over", () => {
    const afterSkip = playEvents(mockSession(), [...warmUpAsked, { type: "skipWarmUp", now: 4_000 }])
      .state;

    expect(step(afterSkip, { type: "skipWarmUp", now: 5_000 })).toEqual({
      state: afterSkip,
      effects: [],
    });
  });

  it("ignores a skip in a drill", () => {
    const started = playEvents(drill(), scriptedDrill.slice(0, 2)).state;

    expect(step(started, { type: "skipWarmUp", now: 3_000 })).toEqual({
      state: started,
      effects: [],
    });
  });
});

describe("follow-ups", () => {
  const startedMock = [
    { type: "start", now: 1_000 },
    { type: "modelReply", text: "Warm-up?", now: 2_000 },
    { type: "skipWarmUp", now: 3_000 },
    { type: "modelReply", text: "Question 1?", now: 4_000 },
  ] satisfies Event[];
  const vagueAnswer = (): Event => ({
    type: "candidateTurn",
    text: "It went fine.",
    startedAt: 5_000,
    endedAt: 9_000,
    missingSignal: true,
  });
  const mockSession = () => createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" });
  const [first] = mockSession().plan;

  it("asks a follow-up on the same competency while a STAR signal is missing", () => {
    const played = playEvents(mockSession(), [...startedMock, vagueAnswer()]);

    expect(played.effects.at(-1)).toEqual({
      type: "generateTurn",
      kind: "follow-up",
      competency: first,
    });
  });

  const answeredWithFollowUps = (count: number): Event[] =>
    Array.from({ length: count }, (_, i): Event[] => [
      vagueAnswer(),
      { type: "modelReply", text: `Follow-up ${i + 1}?`, now: 10_000 + i },
    ]).flat();

  it("moves to the next planned question once the cap is reached", () => {
    const played = playEvents(mockSession(), [
      ...startedMock,
      ...answeredWithFollowUps(2),
      vagueAnswer(),
    ]);

    expect(played.effects.at(-1)).toEqual({
      type: "generateTurn",
      kind: "question",
      competency: mockSession().plan[1],
    });
  });

  it("reads the cap from config", () => {
    const session = createSession(
      { mode: "mock", durationMinutes: 30, seed: 7, level: "mid" },
      standardStyleWith({ followUpCap: 1 }),
    );
    const played = playEvents(session, [...startedMock, ...answeredWithFollowUps(1), vagueAnswer()]);

    expect(played.effects.at(-1)).toMatchObject({ kind: "question", competency: session.plan[1] });
  });

  it("wraps up a drill once the cap is reached on its only question", () => {
    const played = playEvents(drill(), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Question?", now: 2_000 },
      ...answeredWithFollowUps(2),
      vagueAnswer(),
    ]);

    expect(played.effects.at(-1)).toMatchObject({ kind: "wrap-up" });
  });

  const completeAnswer = (): Event => ({
    type: "candidateTurn",
    text: "I led it, measured the result, and shipped.",
    startedAt: 5_000,
    endedAt: 9_000,
    missingSignal: false,
  });

  it("moves to the next planned question after a complete answer", () => {
    const played = playEvents(mockSession(), [...startedMock, completeAnswer()]);

    expect(played.effects.at(-1)).toEqual({
      type: "generateTurn",
      kind: "question",
      competency: mockSession().plan[1],
    });
  });

  it("gives each question a fresh follow-up budget", () => {
    const played = playEvents(mockSession(), [
      ...startedMock,
      ...answeredWithFollowUps(2),
      vagueAnswer(),
      { type: "modelReply", text: "Question 2?", now: 20_000 },
      vagueAnswer(),
    ]);

    expect(played.effects.at(-1)).toMatchObject({
      kind: "follow-up",
      competency: mockSession().plan[1],
    });
  });
});

describe("the session clock", () => {
  const MINUTE = 60_000;
  const secondsIntoAnswer = (seconds: number) => 2_000 + seconds * 1_000;
  const awaitingAnswer = (events: Event[] = []) =>
    playEvents(drill(), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Tell me about a time you owned a project.", now: 2_000 },
      ...events,
    ]).state;

  it("budgets 10 minutes for a drill and the chosen duration for a mock", () => {
    expect(remainingMs(drill(), 0)).toBe(10 * MINUTE);
    expect(remainingMs(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), 0)).toBe(30 * MINUTE);
    expect(remainingMs(createSession({ mode: "mock", durationMinutes: 45, seed: 7, level: "mid" }), 0)).toBe(45 * MINUTE);
  });

  it("does not run before the session starts", () => {
    expect(remainingMs(drill(), 99 * MINUTE)).toBe(10 * MINUTE);
  });

  it("counts down while the candidate is answering, fast-forwarded by the now input", () => {
    expect(remainingMs(awaitingAnswer(), secondsIntoAnswer(90))).toBe(10 * MINUTE - 90_000);
  });

  it("never shows more than the budget when the reader's now lags the clock", () => {
    expect(remainingMs(awaitingAnswer(), 1_000)).toBe(10 * MINUTE);
  });

  it("never goes below zero", () => {
    expect(remainingMs(awaitingAnswer(), secondsIntoAnswer(11 * 60))).toBe(0);
  });

  it("excludes time spent waiting for the model", () => {
    const started = playEvents(drill(), [{ type: "start", now: 1_000 }]).state;

    expect(remainingMs(started, 500_000)).toBe(10 * MINUTE);
  });

  it("keeps the answer time once the model starts a new wait", () => {
    const answered = awaitingAnswer([
      { type: "candidateTurn", text: "I led it.", startedAt: 2_000, endedAt: secondsIntoAnswer(60) },
    ]);

    expect(remainingMs(answered, secondsIntoAnswer(60) + 5 * MINUTE)).toBe(10 * MINUTE - 60_000);
  });

  it("excludes time away from the tab", () => {
    const returned = awaitingAnswer([
      { type: "tabHidden", now: secondsIntoAnswer(30) },
      { type: "tabVisible", now: secondsIntoAnswer(30) + 5 * MINUTE },
    ]);

    expect(remainingMs(returned, secondsIntoAnswer(30) + 5 * MINUTE + 20_000)).toBe(10 * MINUTE - 50_000);
  });

  it("stays stopped while the tab is hidden", () => {
    const hidden = awaitingAnswer([{ type: "tabHidden", now: secondsIntoAnswer(30) }]);

    expect(remainingMs(hidden, secondsIntoAnswer(30) + 9 * MINUTE)).toBe(10 * MINUTE - 30_000);
  });

  it("does not restart the clock when the tab returns during a model wait", () => {
    const started = playEvents(drill(), [
      { type: "start", now: 1_000 },
      { type: "tabHidden", now: 2_000 },
      { type: "tabVisible", now: 3_000 },
    ]).state;

    expect(remainingMs(started, 500_000)).toBe(10 * MINUTE);
  });

  it("ignores a tab event that repeats the current visibility", () => {
    const state = awaitingAnswer();

    expect(step(state, { type: "tabVisible", now: 9_000 })).toEqual({ state, effects: [] });
  });
});

describe("the nudge", () => {
  const answeringSince = 2_000;
  const at = (seconds: number) => answeringSince + seconds * 1_000;
  const nudgeEffect: Effect = { type: "generateTurn", kind: "nudge", competency: "ownership" };

  const drillAnswering = (events: Event[] = []) =>
    playEvents(drill(), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Tell me about a time you owned a project.", now: answeringSince },
      ...events,
    ]).state;

  const mockAnswering = () =>
    playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Warm up?", now: 1_500 },
      { type: "skipWarmUp", now: 1_800 },
      { type: "modelReply", text: "Question?", now: answeringSince },
    ]).state;

  it("asks for a nudge once a drill answer passes 3 minutes", () => {
    expect(step(drillAnswering(), { type: "tick", now: at(179) }).effects).toEqual([]);
    expect(step(drillAnswering(), { type: "tick", now: at(180) }).effects).toEqual([nudgeEffect]);
  });

  it("asks for a nudge once a mock answer passes 2.5 minutes", () => {
    expect(step(mockAnswering(), { type: "tick", now: at(149) }).effects).toEqual([]);
    expect(step(mockAnswering(), { type: "tick", now: at(150) }).effects).toHaveLength(1);
  });

  it("takes the budget from config", () => {
    const config = standardStyleWith({ nudgeMinutes: { mock: 1, drill: 1 } });
    const state = playEvents(createSession({ mode: "drill", seed: 7, level: "mid" }, config), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Q", now: answeringSince },
    ]).state;

    expect(step(state, { type: "tick", now: at(60) }).effects).toHaveLength(1);
  });

  it("records the nudge as an interviewer turn and keeps waiting for the answer", () => {
    const requested = step(drillAnswering(), { type: "tick", now: at(180) }).state;
    const nudged = step(requested, { type: "nudgeReply", text: "Let's wrap this one up.", now: at(182) }).state;

    expect(nudged.turns.at(-1)).toEqual({
      speaker: "interviewer",
      body: "Let's wrap this one up.",
      kind: "nudge",
      startedAt: at(182),
      endedAt: at(182),
      competency: "ownership",
    });
    expect(nudged.awaiting).toBe("answer");
  });

  it("asks for only one nudge per answer", () => {
    const requested = step(drillAnswering(), { type: "tick", now: at(180) }).state;
    const delivered = step(requested, { type: "nudgeReply", text: "Wrap up.", now: at(181) }).state;

    expect(step(requested, { type: "tick", now: at(400) }).effects).toEqual([]);
    expect(step(delivered, { type: "tick", now: at(800) }).effects).toEqual([]);
  });

  it("lets the candidate keep answering after the nudge", () => {
    const requested = step(drillAnswering(), { type: "tick", now: at(180) }).state;
    const delivered = step(requested, { type: "nudgeReply", text: "Wrap up.", now: at(181) }).state;
    const answered = step(delivered, { type: "candidateTurn", text: "Done.", startedAt: at(0), endedAt: at(200) });

    expect(answered.state.turns.at(-1)?.kind).toBe("answer");
    expect(answered.effects).toEqual([{ type: "generateTurn", kind: "wrap-up", competency: "ownership" }]);
  });

  it("drops a nudge that arrives after the candidate has answered", () => {
    const requested = step(drillAnswering(), { type: "tick", now: at(180) }).state;
    const answered = step(requested, { type: "candidateTurn", text: "Done.", startedAt: at(0), endedAt: at(181) }).state;

    expect(step(answered, { type: "nudgeReply", text: "Late.", now: at(182) })).toEqual({
      state: answered,
      effects: [],
    });
  });

  it("gives each new answer its own budget and its own nudge", () => {
    const requested = step(drillAnswering(), { type: "tick", now: at(180) }).state;
    const delivered = step(requested, { type: "nudgeReply", text: "Wrap up.", now: at(181) }).state;
    const askedFollowUp = step(delivered, {
      type: "candidateTurn",
      text: "Partial.",
      startedAt: at(0),
      endedAt: at(190),
      missingSignal: true,
    }).state;
    const secondAnswer = step(askedFollowUp, { type: "modelReply", text: "And the result?", now: at(195) }).state;

    expect(step(secondAnswer, { type: "tick", now: at(195 + 179) }).effects).toEqual([]);
    expect(step(secondAnswer, { type: "tick", now: at(195 + 180) }).effects).toHaveLength(1);
  });

  it("does not count time away from the tab toward the budget", () => {
    const returned = drillAnswering([
      { type: "tabHidden", now: at(100) },
      { type: "tabVisible", now: at(1_000) },
    ]);

    expect(step(returned, { type: "tick", now: at(1_079) }).effects).toEqual([]);
    expect(step(returned, { type: "tick", now: at(1_080) }).effects).toHaveLength(1);
  });

  it("does not nudge while the model is expected to speak", () => {
    const started = playEvents(drill(), [{ type: "start", now: 1_000 }]).state;

    expect(step(started, { type: "tick", now: 900_000 })).toEqual({ state: started, effects: [] });
  });

  it("does not nudge a warm-up answer", () => {
    const warmingUp = playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Warm up?", now: 1_500 },
    ]).state;

    expect(step(warmingUp, { type: "tick", now: 900_000 }).effects).toEqual([]);
  });
});

describe("when the clock reaches zero", () => {
  const MINUTE = 60_000;
  const answeringSince = 2_000;
  const after = (ms: number) => answeringSince + ms;

  const drillAnswering = () =>
    playEvents(drill(), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Tell me about a time you owned a project.", now: answeringSince },
    ]).state;

  const mockAnsweringFirstQuestion = () =>
    playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Warm up?", now: 1_500 },
      { type: "skipWarmUp", now: 1_800 },
      { type: "modelReply", text: "Question?", now: answeringSince },
    ]).state;

  const wrapUp = (competency: GenerateTurnEffect["competency"]): Effect => ({
    type: "generateTurn",
    kind: "wrap-up",
    competency,
  });

  it("asks no new question and wraps up after the answer in a mock", () => {
    const result = step(mockAnsweringFirstQuestion(), {
      type: "candidateTurn",
      text: "Done.",
      startedAt: answeringSince,
      endedAt: after(30 * MINUTE),
    });

    expect(result.effects).toEqual([wrapUp(result.state.plan[0])]);
    expect(result.state.awaiting).toBe("wrap-up");
  });

  it("skips the follow-up even when the answer is missing signal", () => {
    const result = step(drillAnswering(), {
      type: "candidateTurn",
      text: "Partial.",
      startedAt: answeringSince,
      endedAt: after(10 * MINUTE),
      missingSignal: true,
    });

    expect(result.effects).toEqual([wrapUp("ownership")]);
  });

  it("still asks a follow-up while time remains", () => {
    const result = step(drillAnswering(), {
      type: "candidateTurn",
      text: "Partial.",
      startedAt: answeringSince,
      endedAt: after(10 * MINUTE - 1_000),
      missingSignal: true,
    });

    expect(result.effects).toEqual([{ type: "generateTurn", kind: "follow-up", competency: "ownership" }]);
  });

  it("accepts the in-flight answer before the wrap-up", () => {
    const wrappingUp = step(drillAnswering(), {
      type: "candidateTurn",
      text: "My long answer.",
      startedAt: answeringSince,
      endedAt: after(12 * MINUTE),
    }).state;

    expect(wrappingUp.turns.map(({ kind }) => kind)).toEqual(["question", "answer"]);
    expect(wrappingUp.turns[1].body).toBe("My long answer.");
  });

  it("completes the session with a wrap-up turn", () => {
    const wrappingUp = step(drillAnswering(), {
      type: "candidateTurn",
      text: "My long answer.",
      startedAt: answeringSince,
      endedAt: after(12 * MINUTE),
    }).state;
    const completed = step(wrappingUp, { type: "modelReply", text: "Time is up. Thank you.", now: after(12 * MINUTE + 1_000) }).state;

    expect(completed.status).toBe("completed");
    expect(completed.turns.at(-1)).toMatchObject({ kind: "wrap-up", speaker: "interviewer" });
  });

  it("wraps up instead of asking the first question after a warm-up that ran out the clock", () => {
    const warmingUp = playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Warm up?", now: answeringSince },
    ]).state;

    const answered = step(warmingUp, {
      type: "candidateTurn",
      text: "Fine.",
      startedAt: answeringSince,
      endedAt: after(31 * MINUTE),
    });
    const skipped = step(warmingUp, { type: "skipWarmUp", now: after(31 * MINUTE) });

    expect(answered.state.awaiting).toBe("wrap-up");
    expect(skipped.state.awaiting).toBe("wrap-up");
  });

  it("does not count model-wait time toward zero", () => {
    const waiting = step(drillAnswering(), {
      type: "candidateTurn",
      text: "Short.",
      startedAt: answeringSince,
      endedAt: after(1_000),
      missingSignal: true,
    }).state;
    const secondAnswer = step(waiting, { type: "modelReply", text: "And?", now: after(30 * MINUTE) }).state;
    const result = step(secondAnswer, {
      type: "candidateTurn",
      text: "More.",
      startedAt: after(30 * MINUTE),
      endedAt: after(30 * MINUTE + 5_000),
      missingSignal: true,
    });

    expect(result.effects[0]).toMatchObject({ kind: "follow-up" });
  });
});

describe("stopping a session", () => {
  const drillAnswering = (events: Event[] = []) =>
    playEvents(drill(), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Tell me about a time you owned a project.", now: 2_000 },
      ...events,
    ]).state;

  const answered: Event = { type: "candidateTurn", text: "I led it.", startedAt: 2_000, endedAt: 30_000, missingSignal: true };
  const followUp: Event = { type: "modelReply", text: "And the result?", now: 31_000 };

  it("completes with a partial debrief handoff after a scored answer", () => {
    const result = step(drillAnswering([answered, followUp]), { type: "stop", now: 40_000 });

    expect(result.state.status).toBe("completed");
    expect(result.effects).toEqual([
      {
        type: "buildDebrief",
        transcript: [
          { speaker: "interviewer", body: "Tell me about a time you owned a project." },
          { speaker: "candidate", body: "I led it." },
          { speaker: "interviewer", body: "And the result?" },
        ],
      },
    ]);
  });

  it("completes when stopped while the wrap-up is still being generated", () => {
    const result = step(drillAnswering([{ ...answered, missingSignal: false }]), { type: "stop", now: 40_000 });

    expect(result.state.status).toBe("completed");
    expect(result.effects).toHaveLength(1);
  });

  it("abandons with no debrief when nothing was answered", () => {
    const result = step(drillAnswering(), { type: "stop", now: 5_000 });

    expect(result.state.status).toBe("abandoned");
    expect(result.effects).toEqual([]);
  });

  it("abandons when the only candidate turns are a skipped warm-up", () => {
    const state = playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Warm up?", now: 1_500 },
      { type: "skipWarmUp", now: 1_800 },
      { type: "modelReply", text: "Question?", now: 2_000 },
    ]).state;

    expect(step(state, { type: "stop", now: 5_000 }).state.status).toBe("abandoned");
  });

  it("abandons when the candidate only answered the warm-up", () => {
    const state = playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Warm up?", now: 1_500 },
      { type: "candidateTurn", text: "Fine.", startedAt: 1_500, endedAt: 2_000 },
      { type: "modelReply", text: "Question?", now: 2_500 },
    ]).state;

    expect(step(state, { type: "stop", now: 5_000 }).state.status).toBe("abandoned");
  });

  it("does not treat a nudge as a scored answer", () => {
    const nudged = drillAnswering([
      { type: "tick", now: 2_000 + 3 * 60_000 },
      { type: "nudgeReply", text: "Wrap up.", now: 2_000 + 3 * 60_000 + 500 },
    ]);

    expect(step(nudged, { type: "stop", now: 300_000 }).state.status).toBe("abandoned");
  });

  it("ignores a late model reply once stopped", () => {
    const stopped = step(drillAnswering([answered]), { type: "stop", now: 40_000 }).state;

    expect(step(stopped, { type: "modelReply", text: "Late.", now: 41_000 })).toEqual({
      state: stopped,
      effects: [],
    });
  });

  it("stops the clock", () => {
    const stopped = step(drillAnswering(), { type: "stop", now: 12_000 }).state;

    expect(remainingMs(stopped, 12_000)).toBe(remainingMs(stopped, 900_000));
  });

  it("ignores a stop before the session starts and after it has ended", () => {
    const configured = drill();
    const completed = playEvents(drill(), scriptedDrill).state;

    expect(step(configured, { type: "stop", now: 1_000 })).toEqual({ state: configured, effects: [] });
    expect(step(completed, { type: "stop", now: 99_000 })).toEqual({ state: completed, effects: [] });
  });
});

describe("a coding session", () => {
  const MINUTE = 60_000;
  const answeringSince = 2_000;
  const after = (ms: number) => answeringSince + ms;
  const coding = () => createSession({ mode: "coding", seed: 7, level: "mid" });
  const answering = () =>
    playEvents(coding(), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Reverse a linked list.", now: answeringSince },
    ]).state;
  const submit = (state: SessionState, ms: number) =>
    step(state, { type: "candidateTurn", text: "def solve(): ...", startedAt: answeringSince, endedAt: after(ms) });

  it("runs on its own 25 minute timer", () => {
    expect(remainingMs(coding(), 0)).toBe(25 * MINUTE);
    expect(remainingMs(answering(), after(10 * MINUTE))).toBe(15 * MINUTE);
  });

  it("takes the length from config", () => {
    const session = createSession({ mode: "coding", seed: 7, level: "mid" }, { ...DEFAULT_ENGINE_CONFIG, codingMinutes: 40 });

    expect(remainingMs(session, 0)).toBe(40 * MINUTE);
  });

  it("asks one question and then wraps up", () => {
    const result = submit(answering(), 10 * MINUTE);

    expect(result.state.awaiting).toBe("wrap-up");
    expect(result.state.overruns).toEqual([]);
  });

  it("accepts a submission after zero and records the overrun", () => {
    const result = submit(answering(), 25 * MINUTE + 90_000);

    expect(result.state.turns.at(-1)?.kind).toBe("answer");
    expect(result.state.overruns).toEqual([{ questionIndex: 0, overrunMs: 90_000 }]);
    expect(remainingMs(result.state, after(30 * MINUTE))).toBe(0);
  });

  it("keeps one overrun per question when a follow-up answer also runs late", () => {
    const followUp = step(answering(), {
      type: "candidateTurn",
      text: "Partial.",
      startedAt: answeringSince,
      endedAt: after(26 * MINUTE),
      missingSignal: true,
    }).state;
    const second = playEvents(followUp, [{ type: "modelReply", text: "Why?", now: after(26 * MINUTE) }]).state;
    const result = step(second, {
      type: "candidateTurn",
      text: "More.",
      startedAt: after(26 * MINUTE),
      endedAt: after(28 * MINUTE),
    });

    expect(result.state.overruns).toEqual([{ questionIndex: 0, overrunMs: 3 * MINUTE }]);
  });

  it("does not record an overrun for a submission exactly at zero", () => {
    expect(submit(answering(), 25 * MINUTE).state.overruns).toEqual([]);
  });

  it("never nudges", () => {
    const result = step(answering(), { type: "tick", now: after(20 * MINUTE) });

    expect(result.effects).toEqual([]);
  });
});

describe("a per-question timer", () => {
  const MINUTE = 60_000;
  const perQuestion = () => {
    const state = createSession({ mode: "coding", seed: 7, level: "mid" });
    return { ...state, plan: ["ownership", "conflict"] as SessionState["plan"] };
  };

  it("restarts for each question and records overruns per question", () => {
    const { state } = playEvents(perQuestion(), [
      { type: "start", now: 0 },
      { type: "modelReply", text: "Q1", now: 0 },
      { type: "candidateTurn", text: "A1", startedAt: 0, endedAt: 26 * MINUTE },
      { type: "modelReply", text: "Q2", now: 26 * MINUTE },
    ]);

    expect(remainingMs(state, 26 * MINUTE)).toBe(25 * MINUTE);

    const finished = step(state, { type: "candidateTurn", text: "A2", startedAt: 26 * MINUTE, endedAt: 56 * MINUTE });
    expect(finished.state.overruns).toEqual([
      { questionIndex: 0, overrunMs: 1 * MINUTE },
      { questionIndex: 1, overrunMs: 5 * MINUTE },
    ]);
  });
});

describe("currentQuestionTranscript", () => {
  const turn = (speaker: "interviewer" | "candidate", kind: Turn["kind"], body: string): Turn => ({
    speaker,
    kind,
    body,
    startedAt: 0,
    endedAt: 0,
    competency: "ownership",
  });

  it("keeps the latest question with its answers and follow-ups, and drops earlier questions", () => {
    const state: SessionState = {
      ...createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }),
      turns: [
        turn("interviewer", "warm-up", "How was your week?"),
        turn("candidate", "warm-up", "Good."),
        turn("interviewer", "question", "Q1"),
        turn("candidate", "answer", "A1"),
        turn("interviewer", "question", "Q2"),
        turn("candidate", "answer", "A2"),
        turn("interviewer", "follow-up", "F2"),
      ],
    };

    expect(currentQuestionTranscript(state)).toEqual([
      { speaker: "interviewer", body: "Q2" },
      { speaker: "candidate", body: "A2" },
      { speaker: "interviewer", body: "F2" },
    ]);
  });
});

describe("interviewer style", () => {
  const styled = (style?: InterviewerStyle) => createSession({ mode: "drill", seed: 7, level: "mid", style });
  const answeringSince = 2_000;
  const tickAfterSeconds = (state: SessionState, seconds: number) =>
    step(state, { type: "tick", now: answeringSince + seconds * 1_000 });
  const answering = (state: SessionState) =>
    playEvents(state, [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Question?", now: answeringSince },
    ]).state;

  it("defaults to standard and keeps the style it was configured with", () => {
    expect(styled().style).toBe("standard");
    expect(styled("coaching").style).toBe("coaching");
  });

  it("applies to mock sessions too", () => {
    expect(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid", style: "strict" }).style).toBe("strict");
  });

  it("nudges earlier in coaching than in standard or strict", () => {
    expect(tickAfterSeconds(answering(styled("coaching")), 120).effects).toHaveLength(1);
    expect(tickAfterSeconds(answering(styled("standard")), 120).effects).toEqual([]);
    expect(tickAfterSeconds(answering(styled("strict")), 120).effects).toEqual([]);
  });

  it("sets the hint budget and banner per style", () => {
    expect(styled("strict")).toMatchObject({ hintBudget: 0, showsBanner: false });
    expect(styled("standard")).toMatchObject({ hintBudget: 2, showsBanner: true });
    expect(styled("coaching")).toMatchObject({ hintBudget: 4, showsBanner: true });
  });
});

describe("hints", () => {
  const answeringSince = 2_000;
  const at = (seconds: number) => answeringSince + seconds * 1_000;
  const answeringDrill = (style?: InterviewerStyle) =>
    playEvents(createSession({ mode: "drill", seed: 7, level: "mid", style }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Question?", now: answeringSince },
    ]).state;
  const requestHint = (state: SessionState, seconds = 10) => step(state, { type: "requestHint", now: at(seconds) });
  const hintReply = (state: SessionState, seconds = 12) =>
    step(state, { type: "modelReply", text: "Think about the result.", now: at(seconds) }).state;

  it("asks for a hint turn tied to the current competency", () => {
    const { state, effects } = requestHint(answeringDrill());

    expect(effects).toEqual([{ type: "generateTurn", kind: "hint", competency: "ownership" }]);
    expect(state.awaiting).toBe("hint");
  });

  it("records the hint as an interviewer turn and returns to waiting for the answer", () => {
    const hinted = hintReply(requestHint(answeringDrill()).state);

    expect(hinted.turns.at(-1)).toEqual({
      speaker: "interviewer",
      body: "Think about the result.",
      kind: "hint",
      startedAt: at(12),
      endedAt: at(12),
      competency: "ownership",
    });
    expect(hinted.awaiting).toBe("answer");
  });

  it("counts hints used and remaining from the transcript and the style budget", () => {
    const fresh = answeringDrill();
    const hinted = hintReply(requestHint(fresh).state);

    expect([hintsUsed(fresh), hintsRemaining(fresh)]).toEqual([0, 2]);
    expect([hintsUsed(hinted), hintsRemaining(hinted)]).toEqual([1, 1]);
  });

  it("ignores a hint once the budget is spent", () => {
    const spent = hintReply(requestHint(hintReply(requestHint(answeringDrill()).state)).state);

    expect(hintsRemaining(spent)).toBe(0);
    expect(requestHint(spent)).toEqual({ state: spent, effects: [] });
  });

  it("ignores a hint in strict style", () => {
    const strict = answeringDrill("strict");

    expect(requestHint(strict)).toEqual({ state: strict, effects: [] });
  });

  it("ignores a hint when no answer is awaited", () => {
    const waitingForQuestion = step(createSession({ mode: "drill", seed: 7, level: "mid" }), { type: "start", now: 1_000 }).state;

    expect(requestHint(waitingForQuestion).effects).toEqual([]);
  });

  it("ignores a hint while a hint is already on its way", () => {
    const waitingForHint = requestHint(answeringDrill()).state;

    expect(requestHint(waitingForHint)).toEqual({ state: waitingForHint, effects: [] });
  });

  it("ignores a hint during the warm-up", () => {
    const warmingUp = playEvents(createSession({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid" }), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "How was your week?", now: answeringSince },
    ]).state;

    expect(requestHint(warmingUp).effects).toEqual([]);
  });

  it("does not count toward the follow-up cap", () => {
    const hinted = hintReply(requestHint(answeringDrill()).state);

    expect(hinted.followUpsAsked).toBe(0);
  });

  it("keeps the answer timer running across a hint", () => {
    const hinted = hintReply(requestHint(answeringDrill(), 60).state, 62);

    expect(step(hinted, { type: "tick", now: at(181) }).effects).toEqual([]);
    expect(step(hinted, { type: "tick", now: at(182) }).effects).toHaveLength(1);
  });

  it("does not allow a second nudge after a hint", () => {
    const requested = step(answeringDrill(), { type: "tick", now: at(180) }).state;
    const nudged = step(requested, { type: "nudgeReply", text: "Wrap up.", now: at(181) }).state;
    const hinted = hintReply(requestHint(nudged, 182).state, 184);

    expect(step(hinted, { type: "tick", now: at(600) }).effects).toEqual([]);
  });
});

describe("answerRemainingMs", () => {
  const answeringSince = 2_000;
  const answering = (config: SessionConfig) =>
    playEvents(createSession(config), [
      { type: "start", now: 1_000 },
      { type: "modelReply", text: "Question?", now: answeringSince },
    ]).state;

  it("counts down the nudge budget while the candidate answers", () => {
    const state = answering({ mode: "drill", seed: 7, level: "mid" });

    expect(answerRemainingMs(state, answeringSince + 60_000)).toBe(120_000);
  });

  it("goes negative once the answer runs past the budget", () => {
    const state = answering({ mode: "drill", seed: 7, level: "mid" });

    expect(answerRemainingMs(state, answeringSince + 200_000)).toBe(-20_000);
  });

  it("has no budget in a coding session", () => {
    expect(answerRemainingMs(answering({ mode: "coding", seed: 7, level: "mid" }), answeringSince + 60_000)).toBeNull();
  });
});

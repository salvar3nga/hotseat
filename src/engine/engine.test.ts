import { describe, expect, it } from "vitest";
import { createSession, remainingMs, step } from "./engine";
import { DEFAULT_ENGINE_CONFIG } from "./types";
import type { Effect, Event, SessionState } from "./types";

describe("createSession", () => {
  it("starts configured", () => {
    expect(createSession({ mode: "drill", seed: 7 }).status).toBe("configured");
  });

  it("plans one competency for a drill", () => {
    expect(createSession({ mode: "drill", seed: 7 }).plan).toEqual(["ownership"]);
  });

  it("plans a different competency for a different seed", () => {
    expect(createSession({ mode: "drill", seed: 4 }).plan).toEqual(["communication"]);
  });

  it("keeps the mode it was configured with", () => {
    expect(createSession({ mode: "drill", seed: 7 }).mode).toBe("drill");
  });
});

describe("createSession in mock mode", () => {
  const mock = (durationMinutes: 30 | 45, seed = 7) =>
    createSession({ mode: "mock", durationMinutes, seed });

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
    const config = { mockCompetencyCounts: { 30: 2, 45: 3 }, warmUpMinutes: 5, followUpCap: 2, drillMinutes: 10 } as const;
    const session = createSession({ mode: "mock", durationMinutes: 45, seed: 7 }, config);

    expect(session.plan).toHaveLength(3);
    expect(session.warmUpMinutes).toBe(5);
  });

  it("defaults to a 3 minute warm-up, and a drill has none", () => {
    expect(mock(30).warmUpMinutes).toBe(3);
    expect(createSession({ mode: "drill", seed: 7 }).warmUpMinutes).toBeNull();
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

const drill = () => createSession({ mode: "drill", seed: 7 });

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
  const mockSession = () => createSession({ mode: "mock", durationMinutes: 30, seed: 7 });
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
  const mockSession = () => createSession({ mode: "mock", durationMinutes: 30, seed: 7 });
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
      { mode: "mock", durationMinutes: 30, seed: 7 },
      { ...DEFAULT_ENGINE_CONFIG, followUpCap: 1 },
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
    expect(remainingMs(createSession({ mode: "mock", durationMinutes: 30, seed: 7 }), 0)).toBe(30 * MINUTE);
    expect(remainingMs(createSession({ mode: "mock", durationMinutes: 45, seed: 7 }), 0)).toBe(45 * MINUTE);
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

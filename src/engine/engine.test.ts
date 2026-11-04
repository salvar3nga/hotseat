import { describe, expect, it } from "vitest";
import { createSession, step } from "./engine";
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
    const config = { mockCompetencyCounts: { 30: 2, 45: 3 }, warmUpMinutes: 5 } as const;
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

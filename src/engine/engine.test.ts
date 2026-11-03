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
    expect(createSession({ mode: "drill", seed: 4 }).plan).toEqual(["failure"]);
  });

  it("keeps the mode it was configured with", () => {
    expect(createSession({ mode: "drill", seed: 7 }).mode).toBe("drill");
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

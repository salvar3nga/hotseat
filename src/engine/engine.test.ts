import { describe, expect, it } from "vitest";
import { createSession, step } from "./engine";
import type { Event, SessionState } from "./types";

describe("createSession", () => {
  it("plans the same competency for the same seed", () => {
    const first = createSession({ mode: "drill", seed: 7 });
    const second = createSession({ mode: "drill", seed: 7 });

    expect(first.plan).toEqual(second.plan);
    expect(first.plan).toHaveLength(1);
    expect(first.status).toBe("configured");
  });

  it("can plan a different competency for a different seed", () => {
    const plans = [1, 2, 3, 4, 5, 6].map(
      (seed) => createSession({ mode: "drill", seed }).plan[0],
    );

    expect(new Set(plans).size).toBeGreaterThan(1);
  });
});

function run(initial: SessionState, events: Event[]) {
  return events.reduce(
    (acc, event) => {
      const result = step(acc.state, event);
      return { state: result.state, effects: [...acc.effects, ...result.effects] };
    },
    { state: initial, effects: [] as ReturnType<typeof step>["effects"] },
  );
}

describe("a scripted drill", () => {
  const scriptedDrill: Event[] = [
    { type: "start", now: 1_000 },
    { type: "modelReply", text: "Tell me about a time you owned a project.", now: 2_000 },
    { type: "candidateTurn", text: "I led the migration.", startedAt: 3_000, endedAt: 60_000 },
    { type: "modelReply", text: "Thanks, that is all.", now: 61_000 },
  ];

  it("moves from configured to completed", () => {
    const { state } = run(createSession({ mode: "drill", seed: 7 }), scriptedDrill);

    expect(state.status).toBe("completed");
  });

  it("records each turn with speaker, body, kind, timestamps and competency", () => {
    const initial = createSession({ mode: "drill", seed: 7 });
    const { state } = run(initial, scriptedDrill);
    const competency = initial.plan[0];

    expect(state.turns).toEqual([
      {
        speaker: "interviewer",
        body: "Tell me about a time you owned a project.",
        kind: "question",
        startedAt: 2_000,
        endedAt: 2_000,
        competency,
      },
      {
        speaker: "candidate",
        body: "I led the migration.",
        kind: "answer",
        startedAt: 3_000,
        endedAt: 60_000,
        competency,
      },
      {
        speaker: "interviewer",
        body: "Thanks, that is all.",
        kind: "wrap-up",
        startedAt: 61_000,
        endedAt: 61_000,
        competency,
      },
    ]);
  });

  it("asks its caller for the model instead of calling it", () => {
    const initial = createSession({ mode: "drill", seed: 7 });
    const { effects } = run(initial, scriptedDrill);
    const competency = initial.plan[0];

    expect(effects).toEqual([
      { type: "generateTurn", kind: "question", competency },
      { type: "generateTurn", kind: "wrap-up", competency },
    ]);
  });
});

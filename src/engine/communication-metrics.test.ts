import { describe, expect, it } from "vitest";
import { communicationMetrics } from "./communication-metrics";
import type { Turn, TurnKind } from "./types";

const BUDGET_MS = 150_000;

const interviewer = (kind: TurnKind, at: number): Turn => ({
  speaker: "interviewer",
  body: "text",
  kind,
  startedAt: at,
  endedAt: at,
  competency: "ownership",
});

const answer = (startedAt: number, endedAt: number): Turn => ({
  speaker: "candidate",
  body: "text",
  kind: "answer",
  startedAt,
  endedAt,
  competency: "ownership",
});

describe("communicationMetrics", () => {
  it("returns nothing when the candidate never answered", () => {
    expect(communicationMetrics([interviewer("question", 1_000)], BUDGET_MS)).toBeNull();
  });

  it("measures silence from the interviewer turn to the start of the answer", () => {
    const turns = [interviewer("question", 1_000), answer(1_000, 61_000)];

    expect(communicationMetrics(turns, BUDGET_MS)?.longestSilenceMs).toBe(0);
  });

  it("reports the longest silence across answers", () => {
    const turns = [
      interviewer("question", 0),
      answer(5_000, 60_000),
      interviewer("question", 61_000),
      answer(91_000, 120_000),
      interviewer("question", 121_000),
      answer(124_000, 150_000),
    ];

    expect(communicationMetrics(turns, BUDGET_MS)?.longestSilenceMs).toBe(30_000);
  });

  it("measures silence from a hint when it arrived before the candidate started", () => {
    const turns = [interviewer("question", 10_000), interviewer("hint", 40_000), answer(45_000, 90_000)];

    expect(communicationMetrics(turns, BUDGET_MS)?.longestSilenceMs).toBe(5_000);
  });

  it("ignores a nudge that arrived after the candidate had started", () => {
    const turns = [interviewer("question", 10_000), interviewer("nudge", 200_000), answer(12_000, 250_000)];

    expect(communicationMetrics(turns, BUDGET_MS)?.longestSilenceMs).toBe(2_000);
  });

  it("reports each answer's duration and whether it ran over the budget", () => {
    const turns = [
      interviewer("question", 0),
      answer(0, 100_000),
      interviewer("question", 101_000),
      answer(101_000, 301_000),
    ];

    expect(communicationMetrics(turns, BUDGET_MS)?.answers).toEqual([
      { durationMs: 100_000, overBudget: false },
      { durationMs: 200_000, overBudget: true },
    ]);
  });

  it("never reports an answer as over budget when there is no budget", () => {
    const turns = [interviewer("question", 0), answer(0, 900_000)];

    expect(communicationMetrics(turns, null)?.answers).toEqual([{ durationMs: 900_000, overBudget: false }]);
  });

  it("counts nudges and hints from the turn kinds", () => {
    const turns = [
      interviewer("question", 0),
      interviewer("hint", 5_000),
      interviewer("hint", 9_000),
      interviewer("nudge", 200_000),
      answer(1_000, 250_000),
    ];

    expect(communicationMetrics(turns, BUDGET_MS)).toMatchObject({ nudgeCount: 1, hintCount: 2 });
  });

  it("leaves the skipped and unscored warm-up out", () => {
    const warmUpSkip: Turn = { ...answer(500, 500), kind: "warm-up-skip", body: "" };
    const turns = [interviewer("warm-up", 0), warmUpSkip, interviewer("question", 1_000), answer(1_000, 2_000)];

    expect(communicationMetrics(turns, BUDGET_MS)?.answers).toHaveLength(1);
  });
});

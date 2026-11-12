import { describe, expect, it } from "vitest";
import type { CommunicationMetrics } from "../engine/communication-metrics";
import { readAssessment, readDebrief, readTurn } from "./model-responses";

describe("reading a turn response", () => {
  it("returns the interviewer's text", async () => {
    const outcome = await readTurn(Response.json({ text: "Tell me about a conflict." }));

    expect(outcome).toEqual({ kind: "text", text: "Tell me about a conflict." });
  });

  it("tells the candidate how long to wait when rate limited", async () => {
    const response = Response.json({ code: "rate-limited", retryAfterSeconds: 45 }, { status: 429 });

    const outcome = await readTurn(response);

    expect(outcome).toEqual({ kind: "rate-limited", message: "Too many requests. Try again in 45 seconds." });
  });

  it("rounds long waits up to whole minutes", async () => {
    const response = Response.json({ code: "rate-limited", retryAfterSeconds: 100 }, { status: 429 });

    const outcome = await readTurn(response);

    expect(outcome).toEqual({ kind: "rate-limited", message: "Too many requests. Try again in 2 minutes." });
  });

  it("switches to the sample debrief when the daily spend cap is reached", async () => {
    const response = Response.json({ code: "spend-cap" }, { status: 503 });

    expect(await readTurn(response)).toEqual({ kind: "spend-cap" });
  });

  it("reports any other failure as a failed call", async () => {
    const response = Response.json({ error: "Model call failed" }, { status: 502 });

    expect(await readTurn(response)).toEqual({ kind: "failed" });
  });
});

describe("reading an assessment response", () => {
  it("reports a missing signal", async () => {
    expect(await readAssessment(Response.json({ missingSignal: true }))).toBe(true);
  });

  it.each([429, 502, 503])("counts the answer as complete on a %i so the session is never blocked", async (status) => {
    expect(await readAssessment(Response.json({ code: "rate-limited" }, { status }))).toBe(false);
  });
});

describe("reading a debrief response", () => {
  const transcript = [
    { speaker: "interviewer" as const, body: "Tell me about a time you owned a project." },
    { speaker: "candidate" as const, body: "I took the release checklist over when nobody else would" },
  ];
  const metrics: CommunicationMetrics = { longestSilenceMs: 2_000, answers: [], nudgeCount: 0, hintCount: 0 };
  const context = { transcript, session: { mode: "drill" as const, level: "mid" as const, style: "standard" as const }, metrics, partial: false };

  it("assembles the debrief from the verified scores and proposed weaknesses", async () => {
    const response = Response.json({
      scores: [{ competency: "ownership", value: 4, evidence: ["I took the release checklist over when nobody else would"] }],
      notScored: [],
      weaknesses: [
        {
          competency: "ownership",
          answerQuote: "I took the release checklist over when nobody else would",
          rewrite: "A stronger answer.",
        },
      ],
    });

    const outcome = await readDebrief(response, context);

    expect(outcome).toMatchObject({
      kind: "debrief",
      debrief: {
        scores: [{ competency: "ownership", value: 4 }],
        weaknesses: [{ competency: "ownership", rewrite: "A stronger answer." }],
        practicePlan: [{ competency: "ownership", level: "mid", style: "standard" }, {}, {}],
        partial: false,
      },
    });
  });

  it("reports a failed scoring call so the candidate can try again", async () => {
    const response = Response.json({ error: "Model call failed" }, { status: 502 });

    expect(await readDebrief(response, context)).toEqual({ kind: "failed", message: "The debrief could not be built." });
  });

  it("tells the candidate how long to wait when rate limited", async () => {
    const response = Response.json({ code: "rate-limited", retryAfterSeconds: 30 }, { status: 429 });

    expect(await readDebrief(response, context)).toEqual({
      kind: "failed",
      message: "Too many requests. Try again in 30 seconds.",
    });
  });
});

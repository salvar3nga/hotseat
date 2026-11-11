import { describe, expect, it } from "vitest";
import { readAssessment, readTurn } from "./model-responses";

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

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScoringRequest } from "../engine/debrief";
import { createScoringHandler } from "./scoring-handler";
import type { GenerateReply } from "./turn-handler";

const OWNERSHIP_ANSWER = "Nobody owned it, so I wrote it down, turned it into a script, and asked each team to review.";
const CONFLICT_ANSWER = "We disagreed about caching, so I asked us both to read the query plan together.";

const validBody: ScoringRequest = {
  level: "senior",
  competencies: ["ownership", "conflict"],
  transcript: [
    { speaker: "interviewer", body: "Tell me about a time you owned something outside your job." },
    { speaker: "candidate", body: OWNERSHIP_ANSWER },
    { speaker: "interviewer", body: "Tell me about a disagreement." },
    { speaker: "candidate", body: CONFLICT_ANSWER },
  ],
  metrics: { longestSilenceMs: 4_000, answers: [{ durationMs: 90_000, overBudget: false }], nudgeCount: 1, hintCount: 2 },
};

const ownership = { competency: "ownership", value: 4, evidence: ["I wrote it down, turned it into a script"] };
const conflict = { competency: "conflict", value: 3, evidence: ["I asked us both to read the query plan"] };
const invented = (competency: string) => ({ competency, value: 5, evidence: ["a quote the candidate never said"] });
const weakness = { competency: "conflict", answerQuote: "I asked us both to read the query plan", rewrite: "Stronger." };

const reply = (scores: unknown[], weaknesses: unknown[] = []) => JSON.stringify({ scores, weaknesses });

function post(body: unknown) {
  return new Request("http://localhost/api/debrief", { method: "POST", body: JSON.stringify(body) });
}

const repliesInOrder = (...replies: string[]) => {
  const queue = [...replies];
  return vi.fn<GenerateReply>(async () => queue.shift() ?? "");
};

describe("POST /api/debrief", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns verified scores and the weaknesses the model proposed", async () => {
    const generate = repliesInOrder(reply([ownership, conflict], [weakness]));

    const response = await createScoringHandler(generate)(post(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      scores: [
        { ...ownership, evidence: ownership.evidence },
        { ...conflict, evidence: conflict.evidence },
      ],
      notScored: [],
      weaknesses: [weakness],
    });
  });

  it("calls the model once when every score checks out", async () => {
    const generate = repliesInOrder(reply([ownership, conflict]));

    await createScoringHandler(generate)(post(validBody));

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("gives the model the rubric for the level and the metrics as facts", async () => {
    const generate = repliesInOrder(reply([ownership, conflict]));

    await createScoringHandler(generate)(post(validBody));

    const { instructions, messages } = generate.mock.calls[0][0];
    expect(instructions).toContain("Owns a problem across a team boundary and drives it to a result.");
    expect(instructions).toContain("Candidate level: senior");
    expect(instructions).toContain("Longest silence: 4 seconds");
    expect(instructions).toContain("Hints used: 2");
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain(`Candidate: ${OWNERSHIP_ANSWER}`);
  });

  it("does not ask the model for a verdict, metrics or a practice plan", async () => {
    const generate = repliesInOrder(reply([ownership, conflict]));

    await createScoringHandler(generate)(post(validBody));

    const { instructions } = generate.mock.calls[0][0];
    expect(instructions).not.toMatch(/"(verdict|metrics|practicePlan)"/);
  });

  it("accepts a reply wrapped in a code fence", async () => {
    const generate = repliesInOrder("```json\n" + reply([ownership, conflict]) + "\n```");

    const body = await (await createScoringHandler(generate)(post(validBody))).json();

    expect(body.notScored).toEqual([]);
  });

  it("asks again for a competency whose quote could not be verified, and uses the better answer", async () => {
    const generate = repliesInOrder(reply([ownership, invented("conflict")]), reply([conflict]));

    const body = await (await createScoringHandler(generate)(post(validBody))).json();

    expect(generate).toHaveBeenCalledTimes(2);
    expect(body.scores.map(({ competency }: { competency: string }) => competency)).toEqual(["ownership", "conflict"]);
    expect(body.notScored).toEqual([]);
  });

  it("asks the retry only about the competencies that failed", async () => {
    const generate = repliesInOrder(reply([ownership, invented("conflict")]), reply([conflict]));

    await createScoringHandler(generate)(post(validBody));

    const { instructions } = generate.mock.calls[1][0];
    expect(instructions).toContain("Score only these competencies: conflict.");
    expect(instructions).not.toContain("Competency: ownership");
  });

  it("retries when the first reply cannot be read", async () => {
    const generate = repliesInOrder("Sorry, I cannot do that.", reply([ownership, conflict]));

    const body = await (await createScoringHandler(generate)(post(validBody))).json();

    expect(generate).toHaveBeenCalledTimes(2);
    expect(body.scores).toHaveLength(2);
  });

  it("reports a competency as not scored when the retry still cannot back it up", async () => {
    const generate = repliesInOrder(reply([ownership, invented("conflict")]), reply([invented("conflict")]));

    const body = await (await createScoringHandler(generate)(post(validBody))).json();

    expect(generate).toHaveBeenCalledTimes(2);
    expect(body.notScored).toEqual(["conflict"]);
    expect(body.scores).toHaveLength(1);
  });

  it("keeps the first run's scores when the retry call fails", async () => {
    const generate = vi
      .fn<GenerateReply>()
      .mockResolvedValueOnce(reply([ownership, invented("conflict")]))
      .mockRejectedValueOnce(new Error("upstream down"));

    const response = await createScoringHandler(generate)(post(validBody));

    expect(response.status).toBe(200);
    expect((await response.json()).notScored).toEqual(["conflict"]);
  });

  it("answers with an error the browser can show when no score survives the retry", async () => {
    const generate = repliesInOrder(reply([invented("ownership"), invented("conflict")]), reply([]));

    const response = await createScoringHandler(generate)(post(validBody));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "No score could be verified", code: "unscorable" });
  });

  it.each([
    ["no transcript", { ...validBody, transcript: undefined }],
    ["an unknown level", { ...validBody, level: "intern" }],
    ["no competencies to score", { ...validBody, competencies: [] }],
    ["an unknown competency", { ...validBody, competencies: ["ownership", "charisma"] }],
    ["malformed metrics", { ...validBody, metrics: { nudgeCount: "many" } }],
  ])("rejects a request with %s without calling the model", async (_name, body) => {
    const generate = vi.fn<GenerateReply>(async () => "unused");

    const response = await createScoringHandler(generate)(post(body));

    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("hides model failures behind a generic error and logs no transcript content", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createScoringHandler(async () => {
      throw new Error("upstream failed for: I wrote it down, turned it into a script");
    });

    const response = await handler(post(validBody));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Model call failed" });
    expect(JSON.stringify(logged.mock.calls)).not.toContain("script");
  });
});

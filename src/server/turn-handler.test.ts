import { afterEach, describe, expect, it, vi } from "vitest";
import { createTurnHandler, type GenerateReply } from "./turn-handler";

const validBody = {
  kind: "question",
  competency: "ownership",
  transcript: [],
};

function post(body: unknown) {
  return new Request("http://localhost/api/turn", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/turn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the model's reply text", async () => {
    const handler = createTurnHandler(async () => "Tell me about a project you owned.");

    const response = await handler(post(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Tell me about a project you owned." });
  });

  it("accepts a warm-up request with no competency", async () => {
    const generate = vi.fn<GenerateReply>(async () => "How has your week been?");
    const handler = createTurnHandler(generate);

    const response = await handler(post({ kind: "warm-up", competency: null, transcript: [] }));

    expect(response.status).toBe(200);
    expect(generate.mock.calls[0][0].instructions).not.toContain("Competency:");
  });

  it("sends the full transcript to the model after an opening user message", async () => {
    const generate = vi.fn<GenerateReply>(async () => "Thanks, that is all.");
    const handler = createTurnHandler(generate);

    await handler(
      post({
        kind: "wrap-up",
        competency: "ownership",
        transcript: [
          { speaker: "interviewer", body: "Tell me about a project you owned." },
          { speaker: "candidate", body: "I led the migration." },
        ],
      }),
    );

    expect(generate.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "I am ready. Please begin." },
      { role: "assistant", content: "Tell me about a project you owned." },
      { role: "user", content: "I led the migration." },
    ]);
  });

  it("rejects a malformed request without calling the model", async () => {
    const generate = vi.fn(async () => "unused");
    const handler = createTurnHandler(generate);

    const response = await handler(post({ kind: "question" }));

    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("hides model failures behind a generic error and logs no transcript content", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createTurnHandler(async () => {
      throw new Error("upstream failed for: I led the secret migration");
    });

    const response = await handler(
      post({
        ...validBody,
        kind: "wrap-up",
        transcript: [{ speaker: "candidate", body: "I led the secret migration" }],
      }),
    );

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secret");
  });
});

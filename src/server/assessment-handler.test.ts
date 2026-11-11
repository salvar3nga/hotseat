import { afterEach, describe, expect, it, vi } from "vitest";
import { createAssessmentHandler } from "./assessment-handler";
import type { GenerateReply } from "./turn-handler";

const validBody = {
  competency: "ownership",
  transcript: [
    { speaker: "interviewer", body: "Tell me about a project you owned." },
    { speaker: "candidate", body: "I led the migration." },
  ],
};

function post(body: unknown) {
  return new Request("http://localhost/api/assess", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/assess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["YES", true],
    ["yes.", true],
    ["No", false],
    ["no", false],
  ])("turns the model's %s into missingSignal %s", async (reply, missingSignal) => {
    const handler = createAssessmentHandler(async () => reply);

    const response = await handler(post(validBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ missingSignal });
  });

  it("treats an unparseable reply as a complete answer", async () => {
    const handler = createAssessmentHandler(async () => "It depends.");

    expect(await (await handler(post(validBody))).json()).toEqual({ missingSignal: false });
  });

  it("sends the transcript and asks about the STAR signals", async () => {
    const generate = vi.fn<GenerateReply>(async () => "no");
    const handler = createAssessmentHandler(generate);

    await handler(post(validBody));

    const { instructions, messages } = generate.mock.calls[0][0];
    expect(instructions).toContain("situation, task, action");
    expect(instructions).toContain("Competency: ownership.");
    expect(messages.at(-1)).toEqual({ role: "user", content: "I led the migration." });
  });

  it("rejects a malformed request without calling the model", async () => {
    const generate = vi.fn(async () => "unused");
    const handler = createAssessmentHandler(generate);

    const response = await handler(post({ competency: "ownership" }));

    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("hides model failures behind a generic error and logs no transcript content", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createAssessmentHandler(async () => {
      throw new Error("upstream failed for: I led the secret migration");
    });

    const response = await handler(post(validBody));

    expect(response.status).toBe(502);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secret");
  });
});

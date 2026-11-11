import { describe, expect, it, vi } from "vitest";

// next/font only works inside the Next compiler, so the test stubs it.
vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "" }) }));

describe("app metadata", () => {
  it("names the app Hotseat", async () => {
    const { metadata } = await import("./layout");

    expect(metadata.title).toBe("Hotseat");
  });
});

import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("app metadata", () => {
  it("names the app Hotseat", () => {
    expect(metadata.title).toBe("Hotseat");
  });
});

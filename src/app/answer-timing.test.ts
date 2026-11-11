import { describe, expect, it } from "vitest";
import { WRAP_UP_WINDOW_MS, answerTiming } from "./answer-timing";

describe("answerTiming", () => {
  it("is on time while more than the wrap-up window remains", () => {
    expect(answerTiming(WRAP_UP_WINDOW_MS + 1)).toBe("on-time");
  });

  it("asks to wrap up in the last stretch of the budget", () => {
    expect(answerTiming(WRAP_UP_WINDOW_MS)).toBe("wrap-up");
    expect(answerTiming(1)).toBe("wrap-up");
  });

  it("is over time once the budget is spent", () => {
    expect(answerTiming(0)).toBe("over");
    expect(answerTiming(-5_000)).toBe("over");
  });
});

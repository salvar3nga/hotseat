import { describe, expect, it } from "vitest";
import { DEFAULT_VERDICT_CONFIG, verdictFor } from "./verdict";
import type { VerdictConfig } from "./verdict";
import type { Competency } from "./types";

const scoresOf = (value: number, competencies: Competency[] = ["ownership", "conflict"]) =>
  competencies.map((competency) => ({ competency, value }));

const verdict = (value: number, level: "junior" | "mid" | "senior" | "staff" = "mid", partial = false) =>
  verdictFor({ scores: scoresOf(value), level, partial });

describe("verdictFor", () => {
  it("gives a different band for the same score at a different level", () => {
    // 3 of 5 is 60 points: Hire for a junior, No hire for a staff candidate
    expect(verdict(3, "junior")?.band).toBe("hire");
    expect(verdict(3, "staff")?.band).toBe("no-hire");
  });

  it("puts a score exactly on a band edge in the higher band", () => {
    // 4 of 5 is 80 points, the mid-level Strong hire edge
    expect(verdict(4, "mid")?.band).toBe("strong-hire");
  });

  it("reports the gap to the hiring bar, negative when below it", () => {
    // 60 points against the mid-level bar of 62
    expect(verdict(3, "mid")).toMatchObject({ score: 60, bar: 62, gapToBar: -2 });
    expect(verdict(4, "mid")).toMatchObject({ score: 80, bar: 62, gapToBar: 18 });
  });

  it("reads bands and bars from config", () => {
    const config: VerdictConfig = {
      ...DEFAULT_VERDICT_CONFIG,
      bands: { ...DEFAULT_VERDICT_CONFIG.bands, mid: { noHire: 10, hire: 20, strongHire: 30 } },
    };

    expect(verdictFor({ scores: scoresOf(3), level: "mid", partial: false }, config)).toMatchObject({
      band: "strong-hire",
      bar: 20,
    });
  });

  it("gives no verdict when nothing is scorable", () => {
    expect(verdictFor({ scores: [], level: "mid", partial: false })).toBeNull();
  });

  it("marks a partial debrief as covering answered competencies only", () => {
    expect(verdict(4, "mid", true)?.coversAnsweredOnly).toBe(true);
    expect(verdict(4, "mid", false)?.coversAnsweredOnly).toBe(false);
  });

  it("leaves regional competencies out of the score", () => {
    const config: VerdictConfig = { ...DEFAULT_VERDICT_CONFIG, regionalCompetencies: ["communication"] };
    const scores = [
      { competency: "ownership" as const, value: 4 },
      { competency: "communication" as const, value: 1 },
    ];

    expect(verdictFor({ scores, level: "mid", partial: false }, config)?.score).toBe(80);
  });

  it("gives no verdict when only regional competencies were scored", () => {
    const config: VerdictConfig = { ...DEFAULT_VERDICT_CONFIG, regionalCompetencies: ["communication"] };
    const scores = [{ competency: "communication" as const, value: 4 }];

    expect(verdictFor({ scores, level: "mid", partial: false }, config)).toBeNull();
  });
});

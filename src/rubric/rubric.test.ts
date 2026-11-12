import { describe, expect, it } from "vitest";
import { LEVELS } from "../engine/ports";
import { COMPETENCIES } from "../engine/types";
import { rubricFor } from "./rubric";

describe("rubricFor", () => {
  it.each(COMPETENCIES)("covers %s with five anchors and a line for every level", (competency) => {
    for (const level of LEVELS) {
      const rubric = rubricFor(competency, level);

      expect(rubric.measures).not.toBe("");
      expect(rubric.anchors.map(({ score }) => score)).toEqual([1, 2, 3, 4, 5]);
      expect(rubric.anchors.every(({ description }) => description.trim() !== "")).toBe(true);
      expect(rubric.levelLine.trim()).not.toBe("");
    }
  });

  it("returns the anchors shared by every level and the line for the asked level", () => {
    const junior = rubricFor("ownership", "junior");
    const staff = rubricFor("ownership", "staff");

    expect(junior.anchors).toEqual(staff.anchors);
    expect(junior.levelLine).not.toBe(staff.levelLine);
  });
});

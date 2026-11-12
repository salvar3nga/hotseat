import { describe, expect, it } from "vitest";
import { verifyScores } from "./evidence";
import type { ProposedScore } from "./evidence";
import type { Competency, TranscriptEntry } from "./types";

const transcript: TranscriptEntry[] = [
  { speaker: "interviewer", body: "Tell me about a time you took responsibility for something outside your job." },
  {
    speaker: "candidate",
    body: "Nobody owned it, so I wrote it down, turned it into a script, and asked each team to review.",
  },
  { speaker: "interviewer", body: "What happened next?" },
  { speaker: "candidate", body: "The next three releases went out on time." },
];

const VERBATIM = "I wrote it down, turned it into a script";

const score = (overrides: Partial<ProposedScore> = {}): ProposedScore => ({
  competency: "ownership",
  value: 4,
  evidence: [VERBATIM],
  ...overrides,
});

const verify = (proposed: ProposedScore[], competencies: Competency[] = ["ownership"]) =>
  verifyScores({ proposed, transcript, competencies });

describe("verifyScores", () => {
  it("keeps a score whose quote appears verbatim in a candidate turn", () => {
    expect(verify([score()])).toEqual({ scores: [score()], notScored: [] });
  });

  it("accepts a quote that differs only in case and spacing", () => {
    const quote = "NOBODY   owned it,\nso I wrote it down";

    expect(verify([score({ evidence: [quote] })]).scores).toEqual([score({ evidence: [quote] })]);
  });

  it("rejects a paraphrase of what the candidate said", () => {
    const result = verify([score({ evidence: ["He built a script to automate it"] })]);

    expect(result).toEqual({ scores: [], notScored: ["ownership"] });
  });

  it("rejects a quote taken from an interviewer turn", () => {
    const result = verify([score({ evidence: ["took responsibility for something outside your job"] })]);

    expect(result.notScored).toEqual(["ownership"]);
  });

  it("rejects a quote of three words or fewer", () => {
    expect(verify([score({ evidence: ["I wrote it"] })]).notScored).toEqual(["ownership"]);
    expect(verify([score({ evidence: ["I wrote it down"] })]).scores).toHaveLength(1);
  });

  it("rejects a quote stitched together from two candidate turns", () => {
    const stitched = "asked each team to review. The next three releases went out on time";

    expect(verify([score({ evidence: [stitched] })]).notScored).toEqual(["ownership"]);
  });

  it("rejects a score with no evidence", () => {
    expect(verify([score({ evidence: [] })]).notScored).toEqual(["ownership"]);
  });

  it("keeps only the quotes that check out", () => {
    const result = verify([score({ evidence: ["He built a script to automate it", VERBATIM] })]);

    expect(result.scores).toEqual([score({ evidence: [VERBATIM] })]);
  });

  it.each([0, 6, 3.5, -1, Number.NaN])("rejects the out-of-range or fractional value %s", (value) => {
    expect(verify([score({ value })]).notScored).toEqual(["ownership"]);
  });

  it.each([1, 2, 3, 4, 5])("accepts the value %s", (value) => {
    expect(verify([score({ value })]).scores).toHaveLength(1);
  });

  it("reports a competency the model left out as not scored", () => {
    const result = verify([score()], ["ownership", "conflict"]);

    expect(result.scores.map(({ competency }) => competency)).toEqual(["ownership"]);
    expect(result.notScored).toEqual(["conflict"]);
  });

  it("ignores a score for a competency that was not asked about", () => {
    const result = verify([score(), score({ competency: "failure" })], ["ownership"]);

    expect(result.scores.map(({ competency }) => competency)).toEqual(["ownership"]);
  });

  it("keeps the first valid score when the model scores a competency twice", () => {
    const result = verify([score({ value: 4 }), score({ value: 2 })]);

    expect(result.scores).toEqual([score({ value: 4 })]);
  });

  it("falls back to a later valid score when the first one fails", () => {
    const result = verify([score({ evidence: [] }), score({ value: 2 })]);

    expect(result.scores).toEqual([score({ value: 2 })]);
  });

  it("scores nothing when there is nothing to score", () => {
    expect(verify([], [])).toEqual({ scores: [], notScored: [] });
  });
});

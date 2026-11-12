import { describe, expect, it } from "vitest";
import { assembleDebrief } from "./debrief";
import type { ProposedWeakness } from "./debrief";
import type { CommunicationMetrics } from "./communication-metrics";
import type { Score } from "./ports";
import type { Competency, SessionState, TranscriptEntry } from "./types";

const ANSWERS: Record<Competency, string> = {
  ownership: "I took the release checklist over when nobody else would",
  conflict: "We disagreed about caching so I asked us to read the query plan",
  ambiguity: "The request was vague so I wrote down my assumptions first",
  failure: "I shipped a migration that locked the table for eleven minutes",
  leadership: "I split the work across three people and checked in daily",
  communication: "I explained the tradeoff to the product manager with a diagram",
};

const transcript: TranscriptEntry[] = [
  { speaker: "interviewer", body: "Tell me about a time you led without authority." },
  ...Object.values(ANSWERS).map((body) => ({ speaker: "candidate" as const, body })),
];

const metrics: CommunicationMetrics = { longestSilenceMs: 4_000, answers: [], nudgeCount: 1, hintCount: 0 };

const scored = (competency: Competency, value: number): Score => ({ competency, value, evidence: [ANSWERS[competency]] });

const weakness = (competency: Competency, overrides: Partial<ProposedWeakness> = {}): ProposedWeakness => ({
  competency,
  answerQuote: ANSWERS[competency],
  rewrite: "A stronger version of that answer.",
  ...overrides,
});

type Input = {
  scores?: Score[];
  notScored?: Competency[];
  weaknesses?: ProposedWeakness[];
  mode?: SessionState["mode"];
  partial?: boolean;
};

const assemble = ({ scores = [], notScored = [], weaknesses = [], mode = "mock", partial = false }: Input) =>
  assembleDebrief({
    verified: { scores, notScored },
    proposedWeaknesses: weaknesses,
    transcript,
    session: { mode, level: "mid", style: "standard" },
    metrics,
    partial,
  });

const competenciesOf = (items: { competency: Competency }[]) => items.map(({ competency }) => competency);

describe("assembleDebrief weaknesses", () => {
  const scores = [scored("ownership", 2), scored("conflict", 3), scored("failure", 4), scored("leadership", 1)];

  it("keeps a weakness for a scored competency whose answer the candidate really gave", () => {
    expect(assemble({ scores, weaknesses: [weakness("ownership")] }).weaknesses).toEqual([weakness("ownership")]);
  });

  it("drops a weakness for a competency that was not scored", () => {
    const debrief = assemble({ scores, notScored: ["ambiguity"], weaknesses: [weakness("ambiguity")] });

    expect(debrief.weaknesses).toEqual([]);
  });

  it("drops a weakness whose rewritten answer the candidate never gave", () => {
    const invented = weakness("ownership", { answerQuote: "I single-handedly saved the entire company" });

    expect(assemble({ scores, weaknesses: [invented] }).weaknesses).toEqual([]);
  });

  it("drops a weakness with no rewrite", () => {
    expect(assemble({ scores, weaknesses: [weakness("ownership", { rewrite: "  " })] }).weaknesses).toEqual([]);
  });

  it("keeps at most three, lowest score first", () => {
    const debrief = assemble({
      scores,
      weaknesses: ["failure", "ownership", "conflict", "leadership"].map((c) => weakness(c as Competency)),
    });

    expect(competenciesOf(debrief.weaknesses)).toEqual(["leadership", "ownership", "conflict"]);
  });

  it("keeps the first weakness when the model repeats a competency", () => {
    const first = weakness("ownership", { rewrite: "First." });
    const debrief = assemble({ scores, weaknesses: [first, weakness("ownership", { rewrite: "Second." })] });

    expect(debrief.weaknesses).toEqual([first]);
  });

  it("keeps at most one weakness in a drill", () => {
    const debrief = assemble({ scores, mode: "drill", weaknesses: [weakness("leadership"), weakness("ownership")] });

    expect(competenciesOf(debrief.weaknesses)).toEqual(["leadership"]);
  });
});

describe("assembleDebrief practice plan", () => {
  const plan = (input: Input) => competenciesOf(assemble(input).practicePlan);

  it("lists the lowest scores first", () => {
    const scores = [scored("ownership", 4), scored("conflict", 2), scored("failure", 3)];

    expect(plan({ scores })).toEqual(["conflict", "failure", "ownership"]);
  });

  it("puts competencies that were not scored after the scored ones", () => {
    const scores = [scored("ownership", 4), scored("conflict", 2)];

    expect(plan({ scores, notScored: ["failure"] })).toEqual(["conflict", "ownership", "failure"]);
  });

  it("lists at most three", () => {
    const scores = [scored("ownership", 1), scored("conflict", 2), scored("failure", 3), scored("leadership", 4)];

    expect(plan({ scores })).toEqual(["ownership", "conflict", "failure"]);
  });

  it("fills a drill's plan from the competencies it did not cover", () => {
    expect(plan({ scores: [scored("ownership", 2)], mode: "drill" })).toEqual(["ownership", "conflict", "ambiguity"]);
  });

  it("still lists the weakest competencies when every score is strong", () => {
    const scores = [scored("ownership", 5), scored("conflict", 4), scored("failure", 5), scored("leadership", 4)];

    expect(plan({ scores })).toEqual(["conflict", "leadership", "ownership"]);
  });

  it("gives each item what a drill needs to start", () => {
    expect(assemble({ scores: [scored("ownership", 2)] }).practicePlan[0]).toEqual({
      competency: "ownership",
      level: "mid",
      style: "standard",
    });
  });
});

describe("assembleDebrief", () => {
  it("carries the scores, the unscored competencies, the metrics and the partial flag unchanged", () => {
    const scores = [scored("ownership", 3)];
    const debrief = assemble({ scores, notScored: ["conflict"], partial: true });

    expect(debrief).toMatchObject({ scores, notScored: ["conflict"], metrics, partial: true });
  });
});

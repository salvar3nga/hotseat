import type { Competency } from "./types";

export const LEVELS = ["junior", "mid", "senior", "staff"] as const;

export type Level = (typeof LEVELS)[number];

export type Score = { competency: Competency; value: number; evidence: string[] };

export type Debrief = { scores: Score[] };

export type Ports = {
  resolveLevel: (input: {
    years: number;
    targetLevel?: Level;
    jobDescription?: string;
  }) => Level;
  scoreCompetency: (competency: Competency, level: Level, transcript: string) => Score;
  nextFollowUp: (competency: Competency, level: Level, transcript: string) => string | null;
  buildDebrief: (transcript: string) => Debrief;
};

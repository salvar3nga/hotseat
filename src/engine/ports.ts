import type { Competency } from "./types";

export type Level = "junior" | "mid" | "senior" | "staff";

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

import type { Competency } from "./types";

export const LEVELS = ["junior", "mid", "senior", "staff"] as const;

export type Level = (typeof LEVELS)[number];

export type Score = { competency: Competency; value: number; evidence: string[] };

export type Ports = {
  resolveLevel: (input: {
    years: number;
    targetLevel?: Level;
    jobDescription?: string;
  }) => Level;
};

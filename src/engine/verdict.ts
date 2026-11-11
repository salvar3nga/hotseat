import type { Level } from "./ports";
import type { Competency } from "./types";

export const VERDICT_BANDS = ["strong-no-hire", "no-hire", "hire", "strong-hire"] as const;

export type VerdictBand = (typeof VERDICT_BANDS)[number];

// Lower edge of each band above Strong no hire. The hire edge is the hiring bar for the level.
export type BandEdges = { noHire: number; hire: number; strongHire: number };

export type VerdictConfig = {
  bands: Record<Level, BandEdges>;
  regionalCompetencies: readonly Competency[];
};

// Placeholders, to be tuned against the eval fixtures.
export const DEFAULT_VERDICT_CONFIG: VerdictConfig = {
  bands: {
    junior: { noHire: 40, hire: 55, strongHire: 75 },
    mid: { noHire: 45, hire: 62, strongHire: 80 },
    senior: { noHire: 50, hire: 68, strongHire: 85 },
    staff: { noHire: 55, hire: 74, strongHire: 90 },
  },
  regionalCompetencies: [],
};

export const MAX_COMPETENCY_SCORE = 5;

export type Verdict = {
  band: VerdictBand;
  score: number;
  bar: number;
  gapToBar: number;
  coversAnsweredOnly: boolean;
};

export type VerdictInput = {
  scores: { competency: Competency; value: number }[];
  level: Level;
  partial: boolean;
};

function bandFor(score: number, { noHire, hire, strongHire }: BandEdges): VerdictBand {
  if (score >= strongHire) return "strong-hire";
  if (score >= hire) return "hire";
  if (score >= noHire) return "no-hire";
  return "strong-no-hire";
}

export function verdictFor(
  { scores, level, partial }: VerdictInput,
  config: VerdictConfig = DEFAULT_VERDICT_CONFIG,
): Verdict | null {
  const scored = scores.filter(({ competency }) => !config.regionalCompetencies.includes(competency));
  if (scored.length === 0) return null;

  const total = scored.reduce((sum, { value }) => sum + value, 0);
  const score = (total * 100) / (scored.length * MAX_COMPETENCY_SCORE);
  const edges = config.bands[level];
  return {
    band: bandFor(score, edges),
    score,
    bar: edges.hire,
    gapToBar: score - edges.hire,
    coversAnsweredOnly: partial,
  };
}

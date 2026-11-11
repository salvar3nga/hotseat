import type { Level } from "../engine/ports";
import { DEFAULT_VERDICT_CONFIG } from "../engine/verdict";
import type { VerdictBand } from "../engine/verdict";

export const BAND_LABELS: Record<VerdictBand, string> = {
  "strong-no-hire": "Strong no hire",
  "no-hire": "No hire",
  hire: "Hire",
  "strong-hire": "Strong hire",
};

export function ScoringBands({ level }: { level: Level }) {
  const { noHire, hire, strongHire } = DEFAULT_VERDICT_CONFIG.bands[level];
  return (
    <section aria-label="How you will be judged">
      <p>Hiring bar for {level}: {hire} out of 100.</p>
      <ul>
        <li>{BAND_LABELS["strong-no-hire"]}: below {noHire}</li>
        <li>{BAND_LABELS["no-hire"]}: {noHire} to {hire - 1}</li>
        <li>{BAND_LABELS.hire}: {hire} to {strongHire - 1}</li>
        <li>{BAND_LABELS["strong-hire"]}: {strongHire} and above</li>
      </ul>
    </section>
  );
}

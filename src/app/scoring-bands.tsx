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
  const bands: { band: VerdictBand; span: number; from: string; isBar?: boolean }[] = [
    { band: "strong-no-hire", span: noHire, from: `below ${noHire}` },
    { band: "no-hire", span: hire - noHire, from: `from ${noHire}` },
    { band: "hire", span: strongHire - hire, from: `from ${hire}`, isBar: true },
    { band: "strong-hire", span: 100 - strongHire, from: `from ${strongHire}` },
  ];
  return (
    <section aria-label="How you will be judged">
      <p className="bands-bar" role="status">
        Hiring bar for {level}: {hire} out of 100.
      </p>
      <ol className="band-scale">
        {bands.map(({ band, span, from, isBar }) => (
          <li key={band} data-band={band} data-bar={isBar || undefined} style={{ "--span": span } as React.CSSProperties}>
            <span className="band-name">{BAND_LABELS[band]}</span>
            <span className="band-from">{from}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

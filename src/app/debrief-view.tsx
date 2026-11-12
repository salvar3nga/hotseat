import type { Debrief, PracticeItem } from "../engine/debrief";

type DebriefViewProps = { debrief: Debrief; onPractice: (item: PracticeItem) => void };

export function DebriefView({ debrief, onPractice }: DebriefViewProps) {
  const covered = [...debrief.scores.map(({ competency }) => competency), ...debrief.notScored];

  return (
    <section className="panel" aria-label="Debrief">
      <h2>Debrief</h2>
      {debrief.partial && <p>Partial debrief. It covers only: {covered.join(", ")}.</p>}

      <h3>Scores</h3>
      <ul>
        {debrief.scores.map(({ competency, value, evidence }) => (
          <li key={competency}>
            <strong>{competency}</strong>: {value} of 5
            {evidence.map((quote) => (
              <blockquote key={quote}>{quote}</blockquote>
            ))}
          </li>
        ))}
        {debrief.notScored.map((competency) => (
          <li key={competency}>
            <strong>{competency}</strong>: not scored
          </li>
        ))}
      </ul>

      {debrief.weaknesses.length > 0 && (
        <>
          <h3>Weaknesses</h3>
          <ul>
            {debrief.weaknesses.map(({ competency, answerQuote, rewrite }) => (
              <li key={competency}>
                <strong>{competency}</strong>
                <p>You said:</p>
                <blockquote>{answerQuote}</blockquote>
                <p>A stronger answer:</p>
                <blockquote>{rewrite}</blockquote>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Practice plan</h3>
      <ul>
        {debrief.practicePlan.map((item) => (
          <li key={item.competency}>
            {item.competency} ({item.level}, {item.style}){" "}
            <button className="button button-secondary" type="button" onClick={() => onPractice(item)}>
              Start drill
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

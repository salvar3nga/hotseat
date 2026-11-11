import { answerTiming, formatClock } from "./answer-timing";
import type { AnswerTiming } from "./answer-timing";

const LABELS: Record<AnswerTiming, string> = {
  "on-time": "On time",
  "wrap-up": "Wrap up",
  over: "Over time",
};

type TimingCardProps = { remainingMs: number; answering: boolean };

// Colour never carries the state alone: the label and the numerals say it too.
export function TimingCard({ remainingMs, answering }: TimingCardProps) {
  const tone = answering ? answerTiming(remainingMs) : "idle";
  const time = !answering ? "–:––" : remainingMs > 0 ? formatClock(remainingMs) : `+${formatClock(-remainingMs)}`;
  return (
    <div className="timing-card" data-tone={tone}>
      <p className="timing-card-time" role="timer">
        <span className="visually-hidden">Answer time left </span>
        {time}
      </p>
      <p className="timing-card-label" role="status">
        {answering ? LABELS[answerTiming(remainingMs)] : "Waiting"}
      </p>
    </div>
  );
}

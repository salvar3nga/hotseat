export type AnswerTiming = "on-time" | "wrap-up" | "over";

export const WRAP_UP_WINDOW_MS = 30_000;

export function answerTiming(remainingMs: number): AnswerTiming {
  if (remainingMs <= 0) return "over";
  return remainingMs <= WRAP_UP_WINDOW_MS ? "wrap-up" : "on-time";
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

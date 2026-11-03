"use client";

import { useState } from "react";
import { createSession, step } from "../engine/engine";
import type { SessionState, StepResult, TurnRequest } from "../engine/types";

async function requestModelText({ state, effects }: StepResult): Promise<string> {
  const [effect] = effects;
  const body: TurnRequest = {
    kind: effect.kind,
    competency: effect.competency,
    transcript: state.turns.map(({ speaker, body }) => ({ speaker, body })),
  };
  const response = await fetch("/api/turn", { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) throw new Error("The interviewer could not respond.");
  const { text } = (await response.json()) as { text: string };
  return text;
}

// Feeds each model reply back into the engine. Progress is reported after every
// step so a failed call leaves the unfinished effects available for a retry.
async function runUntilIdle(
  initial: StepResult,
  onProgress: (progress: StepResult) => void,
): Promise<void> {
  let progress = initial;
  while (progress.effects.length > 0) {
    const text = await requestModelText(progress);
    progress = step(progress.state, { type: "modelReply", text, now: Date.now() });
    onProgress(progress);
  }
}

export function DrillSession() {
  const [progress, setProgress] = useState<StepResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state: SessionState | null = progress?.state ?? null;
  const replyPending = !busy && progress !== null && progress.effects.length > 0;

  async function advance(next: StepResult) {
    setProgress(next);
    setBusy(true);
    setError(null);
    try {
      await runUntilIdle(next, setProgress);
      setAnswerStartedAt(Date.now());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function startDrill() {
    const seed = Math.floor(Math.random() * 2 ** 32);
    void advance(step(createSession({ mode: "drill", seed }), { type: "start", now: Date.now() }));
  }

  function submitAnswer() {
    const text = answer.trim();
    if (!state || !text) return;
    setAnswer("");
    void advance(
      step(state, {
        type: "candidateTurn",
        text,
        startedAt: answerStartedAt ?? Date.now(),
        endedAt: Date.now(),
      }),
    );
  }

  return (
    <section>
      <p>Your answers are sent to the Claude API to generate the interviewer&apos;s replies.</p>

      {!state && (
        <button onClick={startDrill} disabled={busy}>
          Start a drill
        </button>
      )}

      {state && (
        <ol>
          {state.turns.map((turn, index) => (
            <li key={index}>
              <strong>{turn.speaker === "interviewer" ? "Interviewer" : "You"}:</strong> {turn.body}
            </li>
          ))}
        </ol>
      )}

      {busy && <p>Waiting for the interviewer…</p>}
      {error && <p role="alert">{error}</p>}
      {replyPending && progress && <button onClick={() => void advance(progress)}>Retry</button>}

      {state?.awaiting === "answer" && !busy && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer();
          }}
        >
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={8}
            aria-label="Your answer"
          />
          <button type="submit">Send answer</button>
        </form>
      )}

      {state?.status === "completed" && <p>Drill complete.</p>}
    </section>
  );
}

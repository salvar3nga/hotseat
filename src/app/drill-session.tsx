"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSession, isAnsweringWarmUp, remainingMs, step } from "../engine/engine";
import { isGenerateTurn } from "../engine/types";
import type { AssessmentRequest, Event, SessionState, StepResult, TurnRequest } from "../engine/types";
import { indexedDbSnapshotStore } from "../persistence/indexeddb-snapshot-store";
import { createSessionSnapshots } from "../persistence/session-snapshot";

const snapshots = createSessionSnapshots(indexedDbSnapshotStore);

// Persistence is best effort: a blocked or full IndexedDB must not interrupt the interview.
function ignoreFailure(operation: Promise<unknown>): void {
  operation.catch(() => undefined);
}

async function requestModelText({ state, effects }: StepResult): Promise<string> {
  const effect = effects.find(isGenerateTurn);
  if (!effect) throw new Error("No interviewer turn to generate.");
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

// A failed assessment counts as a complete answer so it never blocks the session.
async function assessMissingSignal(state: SessionState, answer: string): Promise<boolean> {
  const body: AssessmentRequest = {
    competency: state.plan[state.questionIndex],
    transcript: [
      ...state.turns.map(({ speaker, body }) => ({ speaker, body })),
      { speaker: "candidate", body: answer },
    ],
  };
  try {
    const response = await fetch("/api/assess", { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) return false;
    const { missingSignal } = (await response.json()) as { missingSignal: boolean };
    return missingSignal === true;
  } catch {
    return false;
  }
}

// Feeds each model reply back into the engine. Progress is reported after every
// step so a failed call leaves the unfinished effects available for a retry.
// It reads the latest progress after each await because tab events may have changed
// the state while the model was thinking.
async function runUntilIdle(
  readProgress: () => StepResult,
  onProgress: (progress: StepResult) => void,
): Promise<void> {
  while (readProgress().effects.length > 0) {
    const text = await requestModelText(readProgress());
    onProgress(step(readProgress().state, { type: "modelReply", text, now: Date.now() }));
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

export function DrillSession() {
  const [progress, setProgress] = useState<StepResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resumable, setResumable] = useState<StepResult | null | undefined>(undefined);
  const latestProgress = useRef<StepResult | null>(null);

  const state: SessionState | null = progress?.state ?? null;
  const replyPending = !busy && progress !== null && progress.effects.length > 0;

  const commit = useCallback((next: StepResult) => {
    const previous = latestProgress.current;
    latestProgress.current = next;
    setProgress(next);
    ignoreFailure(snapshots.record(previous, next, Date.now()));
  }, []);

  useEffect(() => {
    snapshots
      .loadResumable(Date.now())
      .then(setResumable)
      .catch(() => setResumable(null));
  }, []);

  // Events that never owe the model a turn leave the pending effects untouched.
  const observe = useCallback(
    (event: Event): StepResult | null => {
      const current = latestProgress.current;
      if (!current) return null;
      const result = step(current.state, event);
      if (result.state !== current.state) commit({ state: result.state, effects: current.effects });
      return result;
    },
    [commit],
  );

  const deliverNudge = useCallback(
    async (request: StepResult) => {
      try {
        const text = await requestModelText(request);
        observe({ type: "nudgeReply", text, now: Date.now() });
      } catch {
        // A missed nudge is harmless: the engine will not ask again for this answer.
      }
    },
    [observe],
  );

  useEffect(() => {
    function reportTabVisibility() {
      observe({ type: document.hidden ? "tabHidden" : "tabVisible", now: Date.now() });
    }
    document.addEventListener("visibilitychange", reportTabVisibility);
    return () => document.removeEventListener("visibilitychange", reportTabVisibility);
  }, [observe]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNow(now);
      const ticked = observe({ type: "tick", now });
      if (ticked && ticked.effects.length > 0) void deliverNudge(ticked);
    }, 1000);
    return () => clearInterval(interval);
  }, [observe, deliverNudge]);

  async function advance(next: StepResult) {
    commit(next);
    setBusy(true);
    setError(null);
    try {
      await runUntilIdle(() => latestProgress.current ?? next, commit);
      setAnswerStartedAt(Date.now());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function resumeSaved() {
    if (!resumable) return;
    const saved = resumable;
    setResumable(null);
    setAnswerStartedAt(Date.now());
    void advance(saved);
  }

  function discardSaved() {
    setResumable(null);
    ignoreFailure(snapshots.discard());
  }

  function startDrill() {
    const seed = Math.floor(Math.random() * 2 ** 32);
    void advance(step(createSession({ mode: "drill", seed }), { type: "start", now: Date.now() }));
  }

  async function submitAnswer() {
    const text = answer.trim();
    const latest = latestProgress.current?.state;
    if (!latest || !text) return;
    setAnswer("");
    const endedAt = Date.now();
    if (!isAnsweringWarmUp(latest)) setBusy(true);
    const missingSignal = !isAnsweringWarmUp(latest) && (await assessMissingSignal(latest, text));
    await advance(
      step(latestProgress.current?.state ?? latest, {
        type: "candidateTurn",
        text,
        startedAt: answerStartedAt ?? endedAt,
        endedAt,
        missingSignal,
      }),
    );
  }

  return (
    <section>
      <p>Your answers are sent to the Claude API to generate the interviewer&apos;s replies.</p>

      {!state && resumable && (
        <div>
          <p>You have a drill in progress. Resume it or discard it?</p>
          <button onClick={resumeSaved}>Resume</button>
          <button onClick={discardSaved}>Discard</button>
        </div>
      )}

      {!state && resumable === null && (
        <button onClick={startDrill} disabled={busy}>
          Start a drill
        </button>
      )}

      {state && <p aria-label="Time left">{formatCountdown(remainingMs(state, now))}</p>}

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
            void submitAnswer();
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

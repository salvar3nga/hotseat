"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerRemainingMs,
  canRequestHint,
  createSession,
  currentQuestionTranscript,
  hintsRemaining,
  isAnsweringWarmUp,
  remainingMs,
  step,
} from "../engine/engine";
import { phaseBanner } from "../engine/phase-banner";
import { isGenerateTurn } from "../engine/types";
import type { AssessmentRequest, Event, InterviewerStyle, SessionState, StepResult, TurnKind, TurnRequest } from "../engine/types";
import { indexedDbSnapshotStore } from "../persistence/indexeddb-snapshot-store";
import { createSessionSnapshots } from "../persistence/session-snapshot";
import { readAssessment, readTurn } from "./model-responses";
import { formatClock } from "./answer-timing";
import { SampleDebrief } from "./sample-debrief";
import { StartForm } from "./start-form";
import { TimingCard } from "./timing-card";

const snapshots = createSessionSnapshots(indexedDbSnapshotStore);

// Persistence is best effort: a blocked or full IndexedDB must not interrupt the interview.
function ignoreFailure(operation: Promise<unknown>): void {
  operation.catch(() => undefined);
}

class SpendCapReached extends Error {}

async function requestModelText({ state, effects }: StepResult): Promise<string> {
  const effect = effects.find(isGenerateTurn);
  if (!effect) throw new Error("No interviewer turn to generate.");
  const body: TurnRequest = {
    kind: effect.kind,
    competency: effect.competency,
    transcript: state.turns.map(({ speaker, body }) => ({ speaker, body })),
  };
  const response = await fetch("/api/turn", { method: "POST", body: JSON.stringify(body) });
  const outcome = await readTurn(response);
  switch (outcome.kind) {
    case "text":
      return outcome.text;
    case "rate-limited":
      throw new Error(outcome.message);
    case "spend-cap":
      throw new SpendCapReached();
    case "failed":
      throw new Error("The interviewer could not respond.");
  }
}

// A failed assessment counts as a complete answer so it never blocks the session.
async function assessMissingSignal(state: SessionState, answer: string): Promise<boolean> {
  const body: AssessmentRequest = {
    competency: state.plan[state.questionIndex],
    transcript: [
      ...currentQuestionTranscript(state),
      { speaker: "candidate", body: answer },
    ],
  };
  try {
    const response = await fetch("/api/assess", { method: "POST", body: JSON.stringify(body) });
    return await readAssessment(response);
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

const TURN_TAGS: Partial<Record<TurnKind, string>> = { hint: "Hint", nudge: "Nudge" };

export function DrillSession() {
  const [progress, setProgress] = useState<StepResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spendCapReached, setSpendCapReached] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [resumable, setResumable] = useState<StepResult | null | undefined>(undefined);
  const latestProgress = useRef<StepResult | null>(null);
  const answerBox = useRef<HTMLTextAreaElement>(null);

  const state: SessionState | null = progress?.state ?? null;
  const banner = state ? phaseBanner(state) : null;
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
    } catch (failure) {
      if (failure instanceof SpendCapReached) setSpendCapReached(true);
      else setError(failure instanceof Error ? failure.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function resumeSaved() {
    if (!resumable) return;
    const saved = resumable;
    setResumable(null);
    void advance(saved);
  }

  function discardSaved() {
    setResumable(null);
    ignoreFailure(snapshots.discard());
  }

  function startDrill(style: InterviewerStyle) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    void advance(step(createSession({ mode: "drill", seed, style }), { type: "start", now: Date.now() }));
  }

  function requestHint() {
    const latest = latestProgress.current?.state;
    if (latest) void advance(step(latest, { type: "requestHint", now: Date.now() }));
  }

  async function submitAnswer() {
    const text = answer.trim();
    const latest = latestProgress.current?.state;
    if (!latest || !text) return;
    setAnswer("");
    setAnswerStartedAt(null);
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

  const answering = state?.awaiting === "answer" && !busy;
  useEffect(() => {
    if (answering) answerBox.current?.focus();
  }, [answering]);
  const answerRemaining = state ? answerRemainingMs(state, now) : null;
  const privacy = (
    <p className={`privacy ${state ? "privacy-footer" : "privacy-lead"}`}>
      Your answers are sent to the Claude API to generate the interviewer&apos;s replies.
    </p>
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="wordmark">Hotseat</h1>
        {state && (
          <p className="session-clock" role="timer">
            <span className="session-clock-label">Time left</span>
            <span>{formatClock(remainingMs(state, now))}</span>
          </p>
        )}
      </header>

      {!state && privacy}

      {!state && resumable && (
        <section className="panel">
          <p>You have a drill in progress. Resume it or discard it?</p>
          <div className="button-row">
            <button className="button" onClick={resumeSaved}>
              Resume
            </button>
            <button className="button button-secondary" onClick={discardSaved}>
              Discard
            </button>
          </div>
        </section>
      )}

      {!state && resumable === null && <StartForm onStart={startDrill} disabled={busy} />}

      {banner && (
        <p className="banner" role="status">
          {banner}
        </p>
      )}

      {state && (
        <div className="session-grid">
          {answerRemaining !== null && <TimingCard remainingMs={answerRemaining} answering={answering} />}
          <div className="session-main">
            <ol className="transcript" role="log" aria-label="Interview transcript">
              {state.turns.map((turn, index) => (
                <li className="turn" data-speaker={turn.speaker} key={index}>
                  <strong className="turn-speaker">{turn.speaker === "interviewer" ? "Interviewer" : "You"}</strong>
                  <p className="turn-body">
                    {TURN_TAGS[turn.kind] && <span className="turn-tag">{TURN_TAGS[turn.kind]}</span>}
                    {turn.body}
                  </p>
                </li>
              ))}
            </ol>

            {busy && (
              <p className="waiting" role="status">
                Waiting for the interviewer…
              </p>
            )}
            {error && (
              <p className="alert" role="alert">
                <strong>Error:</strong> {error}
              </p>
            )}
            {replyPending && progress && !spendCapReached && (
              <div className="button-row">
                <button className="button" onClick={() => void advance(progress)}>
                  Retry
                </button>
              </div>
            )}

            {state.status === "in-progress" && (
              <form
                className="answer-form"
                aria-busy={!answering}
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAnswer();
                }}
              >
                <label className="field-label" htmlFor="answer">
                  Your answer
                </label>
                <textarea
                  id="answer"
                  ref={answerBox}
                  className="answer-box"
                  value={answer}
                  disabled={!answering}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setAnswerStartedAt((startedAt) => startedAt ?? Date.now());
                  }}
                  rows={8}
                />
                <div className="button-row">
                  <button className="button" type="submit" disabled={!answering}>
                    Send answer
                  </button>
                  {state.hintBudget > 0 && (
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={requestHint}
                      disabled={!canRequestHint(state)}
                    >
                      Hint ({hintsRemaining(state)} left)
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {spendCapReached && <SampleDebrief />}

      {state?.status === "completed" && (
        <section className="panel">
          <p>Drill complete.</p>
        </section>
      )}

      {state && privacy}
    </div>
  );
}

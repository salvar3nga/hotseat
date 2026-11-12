import type { CommunicationMetrics } from "../engine/communication-metrics";
import { assembleDebrief } from "../engine/debrief";
import type { Debrief, ScoringResponse } from "../engine/debrief";
import type { SessionState, TranscriptEntry } from "../engine/types";

export type TurnOutcome =
  | { kind: "text"; text: string }
  | { kind: "rate-limited"; message: string }
  | { kind: "spend-cap" }
  | { kind: "failed" };

function retryMessage(seconds: number): string {
  const wait = seconds < 60 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
  return `Too many requests. Try again in ${wait}.`;
}

export async function readTurn(response: Response): Promise<TurnOutcome> {
  if (response.ok) {
    const { text } = (await response.json()) as { text: string };
    return { kind: "text", text };
  }
  const body = (await response.json().catch(() => ({}))) as { code?: string; retryAfterSeconds?: number };
  if (body.code === "rate-limited") {
    return { kind: "rate-limited", message: retryMessage(body.retryAfterSeconds ?? 60) };
  }
  if (body.code === "spend-cap") return { kind: "spend-cap" };
  return { kind: "failed" };
}

// Any failure counts as a complete answer so the assessment never blocks the session.
export async function readAssessment(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const { missingSignal } = (await response.json()) as { missingSignal: boolean };
  return missingSignal === true;
}

export type DebriefOutcome = { kind: "debrief"; debrief: Debrief } | { kind: "failed"; message: string };

export type DebriefContext = {
  transcript: TranscriptEntry[];
  session: Pick<SessionState, "mode" | "level" | "style">;
  metrics: CommunicationMetrics;
  partial: boolean;
};

// The scoring route is exempt from the spend cap, so every failure here is one the candidate can retry.
export async function readDebrief(response: Response, context: DebriefContext): Promise<DebriefOutcome> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; retryAfterSeconds?: number };
    const message = body.code === "rate-limited" ? retryMessage(body.retryAfterSeconds ?? 60) : "The debrief could not be built.";
    return { kind: "failed", message };
  }
  const { scores, notScored, weaknesses } = (await response.json()) as ScoringResponse;
  const { transcript, session, metrics, partial } = context;
  return {
    kind: "debrief",
    debrief: assembleDebrief({ verified: { scores, notScored }, proposedWeaknesses: weaknesses, transcript, session, metrics, partial }),
  };
}

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

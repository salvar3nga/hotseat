import { COMPETENCIES, GENERATED_KINDS } from "../engine/types";
import type { TurnRequest } from "../engine/types";

export type ModelRequest = {
  instructions: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

export type GenerateReply = (request: ModelRequest) => Promise<string>;

type TranscriptEntry = TurnRequest["transcript"][number];

function isTranscriptEntry(value: unknown): value is TranscriptEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    (entry.speaker === "interviewer" || entry.speaker === "candidate") &&
    typeof entry.body === "string"
  );
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function parseTurnRequest(value: unknown): TurnRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const { kind, competency, transcript } = value as Record<string, unknown>;
  if (!isOneOf(GENERATED_KINDS, kind)) return null;
  if (!isOneOf(COMPETENCIES, competency)) return null;
  if (!Array.isArray(transcript) || !transcript.every(isTranscriptEntry)) return null;
  return { kind, competency, transcript };
}

const TASK_BY_KIND: Record<TurnRequest["kind"], string> = {
  question: "Ask one behavioral interview question about this competency. Output only the question.",
  "wrap-up": "Close the interview with one or two short sentences. Do not give feedback or scores.",
};

function instructionsFor({ kind, competency }: TurnRequest): string {
  return [
    "You are a rigorous but friendly interviewer running a behavioral interview drill.",
    `Competency: ${competency}.`,
    TASK_BY_KIND[kind],
  ].join("\n");
}

// Anthropic requires the conversation to open with a user message.
const OPENING_MESSAGE = "I am ready. Please begin.";

function toMessages(transcript: TranscriptEntry[]): ModelRequest["messages"] {
  return [
    { role: "user", content: OPENING_MESSAGE },
    ...transcript.map((entry) => ({
      role: entry.speaker === "interviewer" ? ("assistant" as const) : ("user" as const),
      content: entry.body,
    })),
  ];
}

export function createTurnHandler(generate: GenerateReply) {
  return async function handleTurn(request: Request): Promise<Response> {
    const body: unknown = await request.json().catch(() => null);
    const turnRequest = parseTurnRequest(body);
    if (!turnRequest) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
      const text = await generate({
        instructions: instructionsFor(turnRequest),
        messages: toMessages(turnRequest.transcript),
      });
      return Response.json({ text });
    } catch (error) {
      // Error text can echo the prompt, so log only the error type.
      console.error("turn generation failed", error instanceof Error ? error.name : "unknown");
      return Response.json({ error: "Model call failed" }, { status: 502 });
    }
  };
}

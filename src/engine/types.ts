export const COMPETENCIES = ["ownership", "conflict", "ambiguity", "failure"] as const;

export type Competency = (typeof COMPETENCIES)[number];

export type SessionStatus = "configured" | "in-progress" | "completed";

export type TurnKind = "question" | "answer" | "wrap-up";

export type Turn = {
  speaker: "interviewer" | "candidate";
  body: string;
  kind: TurnKind;
  startedAt: number;
  endedAt: number;
  competency: Competency;
};

export type SessionConfig = {
  mode: "drill";
  seed: number;
};

export type SessionState = {
  mode: SessionConfig["mode"];
  status: SessionStatus;
  seed: number;
  plan: Competency[];
  turns: Turn[];
  awaiting: TurnKind | null;
};

export type Event =
  | { type: "start"; now: number }
  | { type: "modelReply"; text: string; now: number }
  | { type: "candidateTurn"; text: string; startedAt: number; endedAt: number };

export const GENERATED_KINDS = ["question", "wrap-up"] as const satisfies readonly TurnKind[];

export type Effect = {
  type: "generateTurn";
  kind: (typeof GENERATED_KINDS)[number];
  competency: Competency;
};

export type StepResult = { state: SessionState; effects: Effect[] };

export type TurnRequest = {
  kind: Effect["kind"];
  competency: Competency;
  transcript: Pick<Turn, "speaker" | "body">[];
};

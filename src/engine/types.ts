export type Competency = "ownership" | "conflict" | "ambiguity" | "failure";

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

export type Effect = {
  type: "generateTurn";
  kind: "question" | "wrap-up";
  competency: Competency;
};

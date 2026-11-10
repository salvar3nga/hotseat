export const COMPETENCIES = [
  "ownership",
  "conflict",
  "ambiguity",
  "failure",
  "leadership",
  "communication",
] as const;

export type Competency = (typeof COMPETENCIES)[number];

export type SessionStatus = "configured" | "in-progress" | "completed";

export type TurnKind = "question" | "answer" | "follow-up" | "wrap-up" | "warm-up" | "warm-up-skip";

export type Turn = {
  speaker: "interviewer" | "candidate";
  body: string;
  kind: TurnKind;
  startedAt: number;
  endedAt: number;
  competency: Competency | null;
};

export type MockDuration = 30 | 45;

export type SessionConfig =
  | { mode: "drill"; seed: number }
  | { mode: "mock"; durationMinutes: MockDuration; seed: number };

export type EngineConfig = {
  mockCompetencyCounts: Record<MockDuration, number>;
  warmUpMinutes: number;
  followUpCap: number;
  drillMinutes: number;
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  mockCompetencyCounts: { 30: 4, 45: 6 },
  warmUpMinutes: 3,
  followUpCap: 2,
  drillMinutes: 10,
};

export type SessionClock = {
  budgetMs: number;
  elapsedMs: number;
  runningSince: number | null;
};

export type SessionState = {
  mode: SessionConfig["mode"];
  status: SessionStatus;
  seed: number;
  plan: Competency[];
  warmUpMinutes: number | null;
  followUpCap: number;
  questionIndex: number;
  followUpsAsked: number;
  turns: Turn[];
  awaiting: TurnKind | null;
  clock: SessionClock;
  tabHidden: boolean;
};

export type Event =
  | { type: "start"; now: number }
  | { type: "modelReply"; text: string; now: number }
  | { type: "skipWarmUp"; now: number }
  | { type: "tabHidden"; now: number }
  | { type: "tabVisible"; now: number }
  | { type: "candidateTurn"; text: string; startedAt: number; endedAt: number; missingSignal?: boolean };

export const GENERATED_KINDS = ["question", "follow-up", "wrap-up", "warm-up"] as const satisfies readonly TurnKind[];

export type Effect = {
  type: "generateTurn";
  kind: (typeof GENERATED_KINDS)[number];
  competency: Competency | null;
};

export type StepResult = { state: SessionState; effects: Effect[] };

export type TurnRequest = {
  kind: Effect["kind"];
  competency: Competency | null;
  transcript: Pick<Turn, "speaker" | "body">[];
};

export function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

import type { Level } from "./ports";

export const COMPETENCIES = [
  "ownership",
  "conflict",
  "ambiguity",
  "failure",
  "leadership",
  "communication",
] as const;

export type Competency = (typeof COMPETENCIES)[number];

export type SessionStatus = "configured" | "in-progress" | "completed" | "abandoned";

export type TurnKind = "question" | "answer" | "follow-up" | "wrap-up" | "warm-up" | "warm-up-skip" | "nudge" | "hint";

export type Turn = {
  speaker: "interviewer" | "candidate";
  body: string;
  kind: TurnKind;
  startedAt: number;
  endedAt: number;
  competency: Competency | null;
};

export type MockDuration = 30 | 45;

export const INTERVIEWER_STYLES = ["strict", "standard", "coaching"] as const;

export type InterviewerStyle = (typeof INTERVIEWER_STYLES)[number];

export type SessionConfig = (
  | { mode: "drill"; seed: number; competency?: Competency }
  | { mode: "mock"; durationMinutes: MockDuration; seed: number }
  | { mode: "coding"; seed: number }
) & { level: Level; style?: InterviewerStyle };

export type NudgedMode = Exclude<SessionConfig["mode"], "coding">;

export type StyleSettings = {
  description: string;
  followUpCap: number;
  nudgeMinutes: Record<NudgedMode, number>;
  hintBudget: number;
  showsBanner: boolean;
};

export type EngineConfig = {
  mockCompetencyCounts: Record<MockDuration, number>;
  warmUpMinutes: number;
  drillMinutes: number;
  codingMinutes: number;
  styles: Record<InterviewerStyle, StyleSettings>;
};

export const DEFAULT_STYLE: InterviewerStyle = "standard";

const DEFAULT_FOLLOW_UP_CAP = 2;
const DEFAULT_NUDGE_MINUTES: StyleSettings["nudgeMinutes"] = { mock: 2.5, drill: 3 };

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  mockCompetencyCounts: { 30: 4, 45: 6 },
  warmUpMinutes: 3,
  drillMinutes: 10,
  codingMinutes: 25,
  styles: {
    strict: {
      description: "No hints and no coaching. Close to a real loop.",
      followUpCap: DEFAULT_FOLLOW_UP_CAP,
      nudgeMinutes: DEFAULT_NUDGE_MINUTES,
      hintBudget: 0,
      showsBanner: false,
    },
    standard: {
      description: "A balanced interviewer with a couple of hints available.",
      followUpCap: DEFAULT_FOLLOW_UP_CAP,
      nudgeMinutes: DEFAULT_NUDGE_MINUTES,
      hintBudget: 2,
      showsBanner: true,
    },
    coaching: {
      description: "More hints, earlier nudges, and a banner on what a good answer covers.",
      followUpCap: DEFAULT_FOLLOW_UP_CAP,
      nudgeMinutes: { mock: 1.5, drill: 2 },
      hintBudget: 4,
      showsBanner: true,
    },
  },
};

export type ClockScope = "session" | "question";

export type SessionClock = {
  scope: ClockScope;
  budgetMs: number;
  elapsedMs: number;
  answerElapsedMs: number;
  runningSince: number | null;
};

export type NudgeStatus = "idle" | "requested" | "sent";

export type Overrun = { questionIndex: number; overrunMs: number };

export type SessionState = {
  mode: SessionConfig["mode"];
  style: InterviewerStyle;
  level: Level;
  status: SessionStatus;
  seed: number;
  plan: Competency[];
  warmUpMinutes: number | null;
  followUpCap: number;
  nudgeBudgetMs: number | null;
  hintBudget: number;
  showsBanner: boolean;
  questionIndex: number;
  followUpsAsked: number;
  turns: Turn[];
  awaiting: TurnKind | null;
  clock: SessionClock;
  tabHidden: boolean;
  nudge: NudgeStatus;
  overruns: Overrun[];
};

export type Event =
  | { type: "start"; now: number }
  | { type: "modelReply"; text: string; now: number }
  | { type: "skipWarmUp"; now: number }
  | { type: "tick"; now: number }
  | { type: "stop"; now: number }
  | { type: "nudgeReply"; text: string; now: number }
  | { type: "requestHint"; now: number }
  | { type: "tabHidden"; now: number }
  | { type: "tabVisible"; now: number }
  | { type: "candidateTurn"; text: string; startedAt: number; endedAt: number; missingSignal?: boolean };

export const GENERATED_KINDS = ["question", "follow-up", "wrap-up", "warm-up", "nudge", "hint"] as const satisfies readonly TurnKind[];

export type TranscriptEntry = Pick<Turn, "speaker" | "body">;

export type GenerateTurnEffect = {
  type: "generateTurn";
  kind: (typeof GENERATED_KINDS)[number];
  competency: Competency | null;
};

export type BuildDebriefEffect = { type: "buildDebrief"; transcript: TranscriptEntry[] };

export type Effect = GenerateTurnEffect | BuildDebriefEffect;

export function isGenerateTurn(effect: Effect): effect is GenerateTurnEffect {
  return effect.type === "generateTurn";
}

export type StepResult = { state: SessionState; effects: Effect[] };

export type TurnRequest = {
  kind: GenerateTurnEffect["kind"];
  competency: Competency | null;
  transcript: TranscriptEntry[];
};

export type AssessmentRequest = {
  competency: Competency;
  transcript: TranscriptEntry[];
};

export function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

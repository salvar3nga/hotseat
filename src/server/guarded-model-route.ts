import { createModelGuard, type GuardConfig } from "./model-guard";

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Budget units are model-call weights, not currency: one interviewer turn costs 3, one assessment 1, one scoring call 5.
export const TURN_COST = 3;
export const ASSESSMENT_COST = 1;
// Placeholder: scoring sends the whole transcript and may retry once. Measure it before trusting this number.
export const SCORING_COST = 5;

function readConfig(): GuardConfig {
  return {
    burstLimit: numberFromEnv("RATE_LIMIT_BURST_PER_MINUTE", 10),
    hourlyLimit: numberFromEnv("RATE_LIMIT_PER_HOUR", 60),
    dailyBudget: numberFromEnv("DAILY_SPEND_BUDGET", 2000),
  };
}

// Next may bundle each route separately; globalThis keeps one set of counters for both.
const shared = globalThis as typeof globalThis & { modelGuard?: ReturnType<typeof createModelGuard> };

export const guardModelRoute = (shared.modelGuard ??= createModelGuard(readConfig(), Date.now));

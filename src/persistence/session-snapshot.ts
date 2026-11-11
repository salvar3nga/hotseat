import { step } from "../engine/engine";
import type { StepResult } from "../engine/types";

export const SNAPSHOT_TTL_MS = 24 * 60 * 60_000;
export const SNAPSHOT_VERSION = 2;

export type Snapshot = { version: number; progress: StepResult; savedAt: number };

// The store hands back whatever is on disk, so the facade owns deciding what is a snapshot.
export type SnapshotStore = {
  read: () => Promise<unknown>;
  write: (snapshot: Snapshot) => Promise<void>;
  remove: () => Promise<void>;
};

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== "object" || value === null) return false;
  const { version, savedAt, progress } = value as Partial<Snapshot>;
  return (
    version === SNAPSHOT_VERSION &&
    typeof savedAt === "number" &&
    Array.isArray(progress?.effects) &&
    Array.isArray(progress?.state?.turns)
  );
}

function isWorthSaving(previous: StepResult | null, next: StepResult): boolean {
  if (!previous) return true;
  return (
    next.state.turns.length !== previous.state.turns.length ||
    next.state.status !== previous.state.status ||
    next.state.tabHidden !== previous.state.tabHidden
  );
}

export function createSessionSnapshots(store: SnapshotStore) {
  async function save(progress: StepResult, now: number): Promise<void> {
    if (progress.state.status === "in-progress") {
      await store.write({ version: SNAPSHOT_VERSION, progress, savedAt: now });
    } else {
      await store.remove();
    }
  }

  return {
    save,

    async record(previous: StepResult | null, next: StepResult, now: number): Promise<void> {
      if (isWorthSaving(previous, next)) await save(next, now);
    },

    async loadResumable(now: number): Promise<StepResult | null> {
      const stored = await store.read();
      if (stored === null || stored === undefined) return null;
      if (!isSnapshot(stored) || now - stored.savedAt > SNAPSHOT_TTL_MS) {
        await store.remove();
        return null;
      }
      const { state, effects } = stored.progress;
      // Closing the tab is time away: pause the clock at the save and run it again from now.
      const away = step(state, { type: "tabHidden", now: stored.savedAt }).state;
      return { state: step(away, { type: "tabVisible", now }).state, effects };
    },

    discard: () => store.remove(),
  };
}

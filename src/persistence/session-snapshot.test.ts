import { describe, expect, it } from "vitest";
import { createSession, remainingMs, step } from "../engine/engine";
import type { StepResult } from "../engine/types";
import { createSessionSnapshots, SNAPSHOT_TTL_MS, SNAPSHOT_VERSION } from "./session-snapshot";
import type { Snapshot, SnapshotStore } from "./session-snapshot";

const MINUTE = 60_000;

function inMemoryStore(): SnapshotStore & { slot: unknown } {
  return {
    slot: null,
    async read() {
      return this.slot;
    },
    async write(snapshot) {
      this.slot = snapshot;
    },
    async remove() {
      this.slot = null;
    },
  };
}

const savedAt = (progress: StepResult, at: number): Snapshot => ({ version: SNAPSHOT_VERSION, progress, savedAt: at });

const answering = (): StepResult => {
  const started = step(createSession({ mode: "drill", seed: 7, level: "mid" }), { type: "start", now: 0 });
  return step(started.state, { type: "modelReply", text: "Tell me about a time.", now: 0 });
};

describe("session snapshots", () => {
  it("resumes an in-progress session with the clock continuing", async () => {
    const store = inMemoryStore();
    const snapshots = createSessionSnapshots(store);
    await snapshots.save(answering(), 2 * MINUTE);

    const resumed = await snapshots.loadResumable(3 * MINUTE);

    expect(resumed?.state.turns).toHaveLength(1);
    expect(remainingMs(resumed!.state, 3 * MINUTE)).toBe(8 * MINUTE);
    expect(remainingMs(resumed!.state, 4 * MINUTE)).toBe(7 * MINUTE);
  });

  it("does not count the time the tab was closed", async () => {
    const snapshots = createSessionSnapshots(inMemoryStore());
    await snapshots.save(answering(), 2 * MINUTE);

    const resumed = await snapshots.loadResumable(60 * MINUTE);

    expect(remainingMs(resumed!.state, 60 * MINUTE)).toBe(8 * MINUTE);
  });

  it("keeps the effects still owed to the model", async () => {
    const snapshots = createSessionSnapshots(inMemoryStore());
    const awaitingModel = step(createSession({ mode: "drill", seed: 7, level: "mid" }), { type: "start", now: 0 });
    await snapshots.save(awaitingModel, 1_000);

    const resumed = await snapshots.loadResumable(2_000);

    expect(resumed?.effects).toEqual(awaitingModel.effects);
  });

  it("returns nothing when no snapshot is saved", async () => {
    expect(await createSessionSnapshots(inMemoryStore()).loadResumable(0)).toBeNull();
  });

  it("discards a snapshot older than 24 hours", async () => {
    const store = inMemoryStore();
    const snapshots = createSessionSnapshots(store);
    await snapshots.save(answering(), 0);

    expect(await snapshots.loadResumable(SNAPSHOT_TTL_MS + 1)).toBeNull();
    expect(store.slot).toBeNull();
  });

  it("still resumes a snapshot exactly 24 hours old", async () => {
    const snapshots = createSessionSnapshots(inMemoryStore());
    await snapshots.save(answering(), 0);

    expect(await snapshots.loadResumable(SNAPSHOT_TTL_MS)).not.toBeNull();
  });

  it("keeps a single slot: a new save replaces the old one", async () => {
    const store = inMemoryStore();
    const snapshots = createSessionSnapshots(store);
    await snapshots.save(answering(), 1_000);
    const later = step(answering().state, { type: "candidateTurn", text: "A.", startedAt: 1, endedAt: 2 });
    await snapshots.save(later, 2_000);

    expect((await snapshots.loadResumable(3_000))?.state.turns).toHaveLength(2);
  });

  it("removes the snapshot when the session ends", async () => {
    const store = inMemoryStore();
    const snapshots = createSessionSnapshots(store);
    await snapshots.save(answering(), 1_000);

    await snapshots.save(step(answering().state, { type: "stop", now: 2_000 }), 2_000);

    expect(store.slot).toBeNull();
  });

  describe("a finished session", () => {
    const withScoredAnswer = () => {
      const answered = step(answering().state, { type: "candidateTurn", text: "I led it.", startedAt: 1, endedAt: 2 });
      return step(answered.state, { type: "stop", now: 3_000 });
    };

    it("is kept while its debrief is still owed, so a failed scoring call can be retried", async () => {
      const store = inMemoryStore();
      const snapshots = createSessionSnapshots(store);
      const finished = withScoredAnswer();

      await snapshots.save(finished, 3_000);

      const resumed = await snapshots.loadResumable(4_000);
      expect(resumed?.state.status).toBe("completed");
      expect(resumed?.effects).toEqual(finished.effects);
    });

    it("is removed once its debrief is no longer owed", async () => {
      const store = inMemoryStore();
      const snapshots = createSessionSnapshots(store);
      await snapshots.save(withScoredAnswer(), 3_000);

      await snapshots.save({ ...withScoredAnswer(), effects: [] }, 4_000);

      expect(store.slot).toBeNull();
    });

    it("still expires after 24 hours", async () => {
      const snapshots = createSessionSnapshots(inMemoryStore());
      await snapshots.save(withScoredAnswer(), 0);

      expect(await snapshots.loadResumable(SNAPSHOT_TTL_MS + 1)).toBeNull();
    });
  });

  it("removes the snapshot on discard, which delete all history also uses", async () => {
    const store = inMemoryStore();
    const snapshots = createSessionSnapshots(store);
    await snapshots.save(answering(), 1_000);

    await snapshots.discard();

    expect(store.slot).toBeNull();
  });

  it("discards stored data that is not a snapshot", async () => {
    const store = inMemoryStore();
    store.slot = { savedAt: "yesterday", progress: {} };

    expect(await createSessionSnapshots(store).loadResumable(0)).toBeNull();
    expect(store.slot).toBeNull();
  });

  it("discards a snapshot saved before sessions carried a level", async () => {
    const store = inMemoryStore();
    store.slot = { ...savedAt(answering(), 0), version: 2 };

    expect(await createSessionSnapshots(store).loadResumable(0)).toBeNull();
    expect(store.slot).toBeNull();
  });

  it("discards a snapshot written by another version", async () => {
    const store = inMemoryStore();
    store.slot = { ...savedAt(answering(), 0), version: SNAPSHOT_VERSION + 1 };

    expect(await createSessionSnapshots(store).loadResumable(0)).toBeNull();
    expect(store.slot).toBeNull();
  });
});

describe("recording progress", () => {
  const recorded = async (previous: StepResult | null, next: StepResult) => {
    const store = inMemoryStore();
    await createSessionSnapshots(store).record(previous, next, 5_000);
    return store.slot;
  };

  it("saves after a turn is added", async () => {
    const before = answering();
    const after = step(before.state, { type: "candidateTurn", text: "A.", startedAt: 1, endedAt: 2 });

    expect(await recorded(before, after)).toEqual(savedAt(after, 5_000));
  });

  it("saves the first progress of a session", async () => {
    const first = answering();

    expect(await recorded(null, first)).toEqual(savedAt(first, 5_000));
  });

  it("saves when the tab is hidden, so the clock stops where the candidate left", async () => {
    const before = answering();
    const hidden = step(before.state, { type: "tabHidden", now: 4_000 });

    expect(await recorded(before, { ...hidden, effects: before.effects })).not.toBeNull();
  });

  it("does not save when nothing worth keeping changed", async () => {
    const before = answering();
    const ticked = step(before.state, { type: "tick", now: 1_000 });

    expect(await recorded(before, ticked)).toBeNull();
  });

  it("removes the snapshot when the session ends", async () => {
    const store = inMemoryStore();
    const snapshots = createSessionSnapshots(store);
    const before = answering();
    await snapshots.save(before, 1_000);

    await snapshots.record(before, step(before.state, { type: "stop", now: 2_000 }), 2_000);

    expect(store.slot).toBeNull();
  });
});

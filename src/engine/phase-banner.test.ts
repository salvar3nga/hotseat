import { describe, expect, it } from "vitest";
import { createSession, step } from "./engine";
import { PHASE_BANNER_COPY, phaseBanner } from "./phase-banner";
import type { Event, InterviewerStyle, SessionConfig, SessionState } from "./types";

const play = (config: SessionConfig, events: Event[]): SessionState =>
  events.reduce((state, event) => step(state, event).state, createSession(config));

const drill = (style?: InterviewerStyle): SessionConfig => ({ mode: "drill", seed: 7, level: "mid", style });
const mock = (style?: InterviewerStyle): SessionConfig => ({ mode: "mock", durationMinutes: 30, seed: 7, level: "mid", style });

const start: Event = { type: "start", now: 1_000 };
const reply = (now: number): Event => ({ type: "modelReply", text: "Interviewer text", now });
const answer = (missingSignal: boolean): Event => ({
  type: "candidateTurn",
  text: "My answer",
  startedAt: 3_000,
  endedAt: 4_000,
  missingSignal,
});

const phases: { phase: keyof typeof PHASE_BANNER_COPY; config: (style?: InterviewerStyle) => SessionConfig; events: Event[] }[] = [
  { phase: "warm-up", config: mock, events: [start, reply(2_000)] },
  { phase: "question", config: drill, events: [start, reply(2_000)] },
  { phase: "follow-up", config: drill, events: [start, reply(2_000), answer(true), reply(5_000)] },
  { phase: "wrap-up", config: drill, events: [start, reply(2_000), answer(false)] },
];

describe("phaseBanner", () => {
  it.each(phases)("says what the interviewer wants in the $phase phase", ({ phase, config, events }) => {
    expect(phaseBanner(play(config("standard"), events))).toBe(PHASE_BANNER_COPY[phase]);
  });

  it.each(phases)("shows the same line in coaching during the $phase phase", ({ phase, config, events }) => {
    expect(phaseBanner(play(config("coaching"), events))).toBe(PHASE_BANNER_COPY[phase]);
  });

  it.each(phases)("is hidden in strict style during the $phase phase", ({ config, events }) => {
    expect(phaseBanner(play(config("strict"), events))).toBeNull();
  });

  it("uses a different line for each phase", () => {
    expect(new Set(Object.values(PHASE_BANNER_COPY)).size).toBe(Object.keys(PHASE_BANNER_COPY).length);
  });

  it("keeps the question line while a nudge or a hint is delivered", () => {
    const asked = play(drill(), [start, reply(2_000)]);
    const nudged = step(step(asked, { type: "tick", now: 2_000 + 180_000 }).state, {
      type: "nudgeReply",
      text: "Wrap up.",
      now: 183_000,
    }).state;
    const hinted = step(step(asked, { type: "requestHint", now: 10_000 }).state, reply(12_000)).state;

    expect(phaseBanner(nudged)).toBe(PHASE_BANNER_COPY.question);
    expect(phaseBanner(hinted)).toBe(PHASE_BANNER_COPY.question);
  });

  it("shows nothing before the session starts or after it ends", () => {
    const finished = play(drill(), [start, reply(2_000), answer(false), reply(5_000)]);

    expect(phaseBanner(createSession(drill()))).toBeNull();
    expect(phaseBanner(finished)).toBeNull();
  });
});

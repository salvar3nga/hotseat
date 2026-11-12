import { describe, expect, it, vi } from "vitest";
import { createModelGuard, type GuardConfig } from "./model-guard";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const config: GuardConfig = {
  burstLimit: 2,
  hourlyLimit: 5,
  dailyBudget: 100,
};

function requestFrom(ip: string) {
  return new Request("http://localhost/api/turn", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

function setup(overrides: Partial<GuardConfig> = {}) {
  let now = Date.UTC(2026, 0, 1, 12);
  const guard = createModelGuard({ ...config, ...overrides }, () => now);
  const inner = vi.fn(async () => Response.json({ ok: true }));
  return {
    inner,
    guarded: guard(inner, { cost: 1 }),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("model guard", () => {
  it("passes requests through to the handler", async () => {
    const { guarded } = setup();

    const response = await guarded(requestFrom("1.1.1.1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("answers 429 with a retry delay once an IP exceeds its burst limit", async () => {
    const { guarded, inner } = setup();
    await guarded(requestFrom("1.1.1.1"));
    await guarded(requestFrom("1.1.1.1"));

    const response = await guarded(requestFrom("1.1.1.1"));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Too many requests", code: "rate-limited", retryAfterSeconds: 60 });
    expect(response.headers.get("retry-after")).toBe("60");
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("lets the same IP through again once the burst window has passed", async () => {
    const { guarded, advance } = setup();
    await guarded(requestFrom("1.1.1.1"));
    await guarded(requestFrom("1.1.1.1"));

    advance(MINUTE);

    expect((await guarded(requestFrom("1.1.1.1"))).status).toBe(200);
  });

  it("limits each IP separately", async () => {
    const { guarded } = setup();
    await guarded(requestFrom("1.1.1.1"));
    await guarded(requestFrom("1.1.1.1"));

    expect((await guarded(requestFrom("2.2.2.2"))).status).toBe(200);
  });

  it("identifies the client by the first address in a forwarded chain", async () => {
    const { guarded } = setup();
    await guarded(requestFrom("1.1.1.1, 10.0.0.1"));
    await guarded(requestFrom("1.1.1.1, 10.0.0.2"));

    expect((await guarded(requestFrom("1.1.1.1, 10.0.0.3"))).status).toBe(429);
  });

  it("answers 429 once an IP exceeds its hourly limit, even when bursts are spaced out", async () => {
    const { guarded, advance } = setup();
    for (let call = 0; call < 5; call++) {
      expect((await guarded(requestFrom("1.1.1.1"))).status).toBe(200);
      advance(MINUTE);
    }

    const response = await guarded(requestFrom("1.1.1.1"));

    expect(response.status).toBe(429);
    expect((await response.json()).retryAfterSeconds).toBe(55 * 60);
  });

  describe("daily spend cap", () => {
    function setupShared(dailyBudget: number) {
      let now = Date.UTC(2026, 0, 1, 12);
      const guard = createModelGuard({ ...config, dailyBudget }, () => now);
      const inner = vi.fn(async () => Response.json({ ok: true }));
      return {
        inner,
        expensive: guard(inner, { cost: 3 }),
        cheap: guard(inner, { cost: 1 }),
        finishing: guard(inner, { cost: 3, exemptFromSpendCap: true }),
        advance: (ms: number) => {
          now += ms;
        },
      };
    }

    it("stops model calls from every IP once the weighted spend reaches the budget", async () => {
      const { expensive, cheap, inner } = setupShared(4);
      await expensive(requestFrom("1.1.1.1"));
      await cheap(requestFrom("2.2.2.2"));

      const response = await cheap(requestFrom("3.3.3.3"));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "Daily spend cap reached", code: "spend-cap" });
      expect(inner).toHaveBeenCalledTimes(2);
    });

    it("does not charge requests that were rate limited", async () => {
      const { expensive, cheap } = setupShared(4);
      await cheap(requestFrom("1.1.1.1"));
      await cheap(requestFrom("1.1.1.1"));
      await expensive(requestFrom("1.1.1.1"));

      expect((await cheap(requestFrom("2.2.2.2"))).status).toBe(200);
    });

    it("lets an exempt route run after the cap is reached", async () => {
      const { cheap, finishing, inner } = setupShared(1);
      await cheap(requestFrom("1.1.1.1"));

      const response = await finishing(requestFrom("2.2.2.2"));

      expect(response.status).toBe(200);
      expect(inner).toHaveBeenCalledTimes(2);
    });

    it("still counts an exempt route's cost toward the budget", async () => {
      const { cheap, finishing } = setupShared(3);
      await finishing(requestFrom("1.1.1.1"));

      expect((await cheap(requestFrom("2.2.2.2"))).status).toBe(503);
    });

    it("still rate limits an exempt route", async () => {
      const { finishing } = setupShared(1);
      await finishing(requestFrom("1.1.1.1"));
      await finishing(requestFrom("1.1.1.1"));

      expect((await finishing(requestFrom("1.1.1.1"))).status).toBe(429);
    });

    it("starts a fresh budget on the next UTC day", async () => {
      const { cheap, advance } = setupShared(1);
      await cheap(requestFrom("1.1.1.1"));

      advance(DAY);

      expect((await cheap(requestFrom("1.1.1.1"))).status).toBe(200);
    });
  });
});

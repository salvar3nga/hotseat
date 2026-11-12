const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type GuardConfig = {
  burstLimit: number;
  hourlyLimit: number;
  dailyBudget: number;
};

type Handler = (request: Request) => Promise<Response>;

function rateLimited(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many requests", code: "rate-limited", retryAfterSeconds },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}

function spendCapReached(): Response {
  return Response.json({ error: "Daily spend cap reached", code: "spend-cap" }, { status: 503 });
}

// Seconds until the oldest call in the window ages out, if the window is full.
function secondsUntilRoom(calls: number[], limit: number, windowMs: number, current: number): number | null {
  const inWindow = calls.filter((at) => current - at < windowMs);
  if (inWindow.length < limit) return null;
  return Math.ceil((inWindow[0] + windowMs - current) / 1000);
}

export function createModelGuard(config: GuardConfig, now: () => number) {
  const callsByIp = new Map<string, number[]>();
  let spend = { day: -1, total: 0 };

  // A route that finishes work already begun is exempt from the daily cap, but still counts toward it.
  return function guard(
    handler: Handler,
    { cost, exemptFromSpendCap = false }: { cost: number; exemptFromSpendCap?: boolean },
  ): Handler {
    return async function guarded(request) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
      const current = now();
      const day = Math.floor(current / DAY_MS);
      if (spend.day !== day) spend = { day, total: 0 };
      if (spend.total >= config.dailyBudget && !exemptFromSpendCap) return spendCapReached();

      const calls = (callsByIp.get(ip) ?? []).filter((at) => current - at < HOUR_MS);

      const waits = [
        secondsUntilRoom(calls, config.burstLimit, MINUTE_MS, current),
        secondsUntilRoom(calls, config.hourlyLimit, HOUR_MS, current),
      ].filter((wait) => wait !== null);
      if (waits.length > 0) return rateLimited(Math.max(...waits));

      callsByIp.set(ip, [...calls, current]);
      spend.total += cost;
      return handler(request);
    };
  };
}

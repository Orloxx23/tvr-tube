import "server-only";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  options?: { max?: number; windowMs?: number }
): RateLimitResult {
  const max = options?.max ?? MAX_REQUESTS;
  const window = options?.windowMs ?? WINDOW_MS;
  const now = Date.now();

  // Lazy GC: every call has a 1% chance to sweep expired buckets.
  if (Math.random() < 0.01) {
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + window });
    return { ok: true, remaining: max - 1, retryAfterSeconds: 0 };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: max - existing.count,
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "local";
}

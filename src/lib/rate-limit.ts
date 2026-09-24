// CivicLens — lightweight in-memory rate limiter (sliding window per key, per process).
// Protects auth endpoints (sign-in / sign-up) against brute-force & credential stuffing.
// Free & dependency-free; for multi-instance production deployments swap for Redis.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

/**
 * Consume one slot for `key`. Returns true when allowed, false when the limit is exceeded.
 * @param key     unique identifier (e.g. `login:ip:1.2.3.4`, `register:ip:1.2.3.4`)
 * @param limit   max attempts within the window
 * @param windowMs window duration in ms
 */
export function consumeRateLimit(key: string, limit = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

/** Extract the caller IP from a Next-style request (best-effort; "local" in dev). */
export function requestIp(headers: Headers | undefined | null): string {
  const fwd = headers?.get?.("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers?.get?.("x-real-ip") ?? "local";
}

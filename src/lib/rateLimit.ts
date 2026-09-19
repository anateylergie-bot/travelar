// Phase 1 rate limiter. IMPORTANT LIMITATION (documented in SECURITY.md):
// this is in-memory and per-process. It is adequate for local development
// and a single-instance deployment, but does NOT protect against a
// distributed attack across multiple server instances, and resets on
// restart. Before production launch with horizontal scaling, this must
// be swapped for a shared store (Redis) — the function signature below is
// deliberately kept simple so that swap doesn't require touching callers.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (existing.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxAttempts - existing.count };
}

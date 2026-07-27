/**
 * Simple in-memory sliding-window rate limiter.
 *
 * NOTE: This is per-process. In a multi-instance deployment each container
 * keeps its own counters, so limits are approximate. For a single-container
 * Docker deployment (the ThreatPulse default) this is sufficient. Swap the
 * backing Map for Redis if you scale horizontally.
 */

interface Bucket {
  timestamps: number[];
}

const store = new Map<string, Bucket>();

// Opportunistic cleanup so the Map does not grow unbounded.
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store.entries()) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Record a hit against `key` and report whether it is within `limit`
 * over the trailing `windowMs` window.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(windowMs);

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }

  // Drop timestamps outside the window.
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  const oldest = bucket.timestamps[0] ?? now;
  const resetAt = new Date(oldest + windowMs);

  if (bucket.timestamps.length >= limit) {
    return { success: false, remaining: 0, limit, resetAt };
  }

  bucket.timestamps.push(now);
  return {
    success: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    limit,
    resetAt,
  };
}

/** Extract a best-effort client IP from a Next.js request's headers. */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}

interface Bucket {
  windowStart: number;
  count: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly windowMs: number = 60_000) {}

  allow(scope: string, maxPerWindow: number): boolean {
    if (!Number.isFinite(maxPerWindow) || maxPerWindow <= 0) return true;
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const bucket = this.buckets.get(scope);
    if (!bucket || bucket.windowStart !== windowStart) {
      this.buckets.set(scope, { windowStart, count: 1 });
      return true;
    }
    if (bucket.count >= maxPerWindow) return false;
    bucket.count += 1;
    return true;
  }
}

export const rateLimiter = new InMemoryRateLimiter();

// 24h rolling window (UTC-day-aligned buckets) for daily quotas.
export const dailyLimiter = new InMemoryRateLimiter(24 * 60 * 60 * 1000);
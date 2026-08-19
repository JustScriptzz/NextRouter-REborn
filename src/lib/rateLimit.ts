interface Bucket {
  windowStart: number;
  count: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;

  allow(scope: string, maxPerMinute: number): boolean {
    if (!Number.isFinite(maxPerMinute) || maxPerMinute <= 0) return true;
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const bucket = this.buckets.get(scope);
    if (!bucket || bucket.windowStart !== windowStart) {
      this.buckets.set(scope, { windowStart, count: 1 });
      return true;
    }
    if (bucket.count >= maxPerMinute) return false;
    bucket.count += 1;
    return true;
  }
}

export const rateLimiter = new InMemoryRateLimiter();
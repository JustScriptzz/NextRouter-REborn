// Serverless: no per-user tracking, no database. Upstream helpers still take
// a tracking id + budget, so keep the shapes and no-op the persistence.
// Public traffic is gated by the fixed per-IP RPM only.

export const UNLIMITED_BUDGET = Number.MAX_SAFE_INTEGER;

export async function recordUsage(_userId: string, _tokens: number): Promise<void> {
  // No-op: nothing to bill against.
}

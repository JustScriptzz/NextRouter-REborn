-- Model health stats (mirrors src/lib/model-stats.ts).
-- events: JSON array of {o: 0|1, t: ms-epoch, lat?, tok?, sec?}, capped at
-- 120 entries by the writer. updated_at: ms-epoch of last write.
-- probe_backoff_until: ms-epoch or NULL.
CREATE TABLE IF NOT EXISTS model_stats (
  id TEXT PRIMARY KEY,
  events TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT 0,
  probe_backoff_until INTEGER
);

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL ?? '';

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
  db?: Db;
  schemaReady?: Promise<void>;
};

const client = globalForDb.pgClient ?? postgres(connectionString, { prepare: false, max: 1 });
if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client;

export const db: Db = globalForDb.db ?? drizzle(client, { schema });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export { client };

// ---------------------------------------------------------------------------
// Self-healing schema bootstrap.
//
// A freshly provisioned database (e.g. a new Render Postgres) may have no
// schema because `drizzle-kit push` can time out before finishing. Without a
// `users` table the login route's `db.select().from(users)` throws
// "relation users does not exist" → HTTP 500 → "logins don't work".
//
// This mirrors the existing kv.ts pattern (which already creates `app_config`)
// and makes the app create its own tables on startup so it works out of the
// box. The DDL matches the Drizzle schema in ./schema. Idempotent.
// Postgres >= 13 supplies gen_random_uuid() natively.
// ---------------------------------------------------------------------------

const schemaStatements: ReturnType<typeof sql>[] = [
  sql`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(32) NOT NULL UNIQUE,
    email varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(64) NOT NULL DEFAULT 'Default key',
    key_hash text NOT NULL,
    masked varchar(32) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at timestamptz
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash)`,
  sql`CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id)`,
  sql`CREATE TABLE IF NOT EXISTS custom_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id varchar(128) NOT NULL,
    title varchar(128) NOT NULL,
    description text,
    accepted_inputs text NOT NULL,
    visibility varchar(16) NOT NULL DEFAULT 'private',
    rpm integer,
    endpoint_url text NOT NULL,
    provider_model_id varchar(255) NOT NULL,
    bearer_token_enc text,
    fallback_model_id varchar(128) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS custom_models_model_id_idx ON custom_models (model_id)`,
  sql`CREATE INDEX IF NOT EXISTS custom_models_user_id_idx ON custom_models (user_id)`,
  sql`CREATE TABLE IF NOT EXISTS daily_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date varchar(10) NOT NULL,
    tokens integer NOT NULL DEFAULT 0,
    calls integer NOT NULL DEFAULT 0
  )`,
  sql`CREATE UNIQUE INDEX IF NOT EXISTS daily_usage_user_date_idx ON daily_usage (user_id, date)`,
];

/**
 * Ensure all application tables exist. Runs once (cached globally) and fires
 * at module load so tables are ready before any route handler queries the DB.
 */
export function ensureSchema(): Promise<void> {
  if (!connectionString) return Promise.resolve();
  if (globalForDb.schemaReady) return globalForDb.schemaReady;
  globalForDb.schemaReady = (async () => {
    for (const stmt of schemaStatements) {
      await db.execute(stmt);
    }
  })().catch((error) => {
    console.error('[DB] Failed to ensure schema:', error);
  });
  return globalForDb.schemaReady;
}

void ensureSchema();
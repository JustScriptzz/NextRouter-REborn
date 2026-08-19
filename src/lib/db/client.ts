import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL ?? '';

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
  db?: Db;
};

const client = globalForDb.pgClient ?? postgres(connectionString, { prepare: false, max: 1 });
if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client;

export const db: Db = globalForDb.db ?? drizzle(client, { schema });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export { client };
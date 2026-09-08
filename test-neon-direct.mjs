// Try direct (non-pooler) Neon endpoint
import postgres from 'postgres';
const direct = 'postgresql://neondb_owner:npg_jfvt1MBCcD2n@ep-tiny-king-avwm9sjd.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(direct, { max: 1, prepare: false, connect_timeout: 15 });
try {
  const r = await sql`select 1 as ok`;
  console.log('direct connect OK:', r[0].ok);
  const tables = await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
  console.log('Tables:', tables.map(t => t.tablename).join(', '));
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await sql.end().catch(()=>{});
}

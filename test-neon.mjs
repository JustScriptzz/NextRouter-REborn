// Test connection to Neon and list table counts
import postgres from 'postgres';
const sql = postgres('postgresql://neondb_owner:npg_jfvt1MBCcD2n@ep-tiny-king-avwm9sjd-pooler.c-11.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require', { max: 1, prepare: false });
try {
  const tables = await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
  console.log('Tables:', tables.map(t => t.tablename).join(', '));
  for (const t of tables) {
    const c = await sql.unsafe(`select count(*)::int as n from "${t.tablename}"`);
    console.log(`  ${t.tablename}: ${c[0].n}`);
  }
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await sql.end();
}

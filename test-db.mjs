import fs from 'node:fs';
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1);
}
console.log('has DATABASE_URL:', Boolean(process.env.DATABASE_URL));
const postgres = (await import('postgres')).default;
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
const r = await sql`select 1 as ok`;
console.log('db ok:', r[0].ok);
await sql.end();

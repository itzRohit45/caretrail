// Applies supabase/migrations/*.sql in name order, once each, inside a transaction per file.
// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is not set (local only, never on Vercel)");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(
  "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())",
);
await client.query("alter table public._migrations enable row level security");
await client.query("revoke all on public._migrations from anon, authenticated");

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const { rows } = await client.query("select name from public._migrations");
const done = new Set(rows.map((r) => r.name));

for (const file of files) {
  if (done.has(file)) continue;
  const sql = await readFile(new URL(file, dir), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query("rollback");
    console.error(`failed ${file}: ${err.message}`);
    process.exitCode = 1;
    break;
  }
}
await client.end();

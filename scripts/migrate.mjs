import { readFile } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local and set your PostgreSQL URL.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(14271407)");
  const sql = await readFile(new URL("../database/001_auth.sql", import.meta.url), "utf8");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Better Auth tables are ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Database migration failed (${error.code || "connection/schema error"}). Check DATABASE_URL, SSL, and database permissions.`);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }

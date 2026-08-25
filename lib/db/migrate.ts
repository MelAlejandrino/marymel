/**
 * Applies a .sql file to the database.
 *
 *   npm run db:migrate -- migrations/001-open-world.sql
 *
 * ponytail: hand-written SQL rather than drizzle-kit. `push` needs an
 * interactive prompt to tell a renamed table from a new one, which is no use
 * in a script, and a destructive migration is worth reading before it runs.
 *
 * Uses the WebSocket pool, not the HTTP driver: HTTP sends one statement per
 * request, and these files are one transaction of many statements.
 */
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run db:migrate -- migrations/001-open-world.sql");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log(`applying ${file} ...`);
try {
  // The file carries its own BEGIN/COMMIT, so it either all lands or none does.
  await pool.query(text);
  console.log("done");
} finally {
  await pool.end();
}

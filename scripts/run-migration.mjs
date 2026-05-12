// Run a migration file against the Supabase DB pointed at by DATABASE_URL.
//
// Usage:
//   node scripts/run-migration.mjs <filename-or-prefix>
//
// Examples:
//   node scripts/run-migration.mjs 019
//   node scripts/run-migration.mjs 019_screen_contexts_route.sql
//
// The prefix form (e.g. "019") matches any file in supabase/migrations/ that
// starts with that string — there is only one per version.

import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/run-migration.mjs <filename-or-prefix>');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local');
  process.exit(1);
}

const MIGRATIONS_DIR = resolve(__dirname, '../supabase/migrations');
const matches = readdirSync(MIGRATIONS_DIR).filter(
  (f) => f === arg || f.startsWith(`${arg}_`) || f.startsWith(arg),
);
if (matches.length === 0) {
  console.error(`No migration file matches "${arg}" in ${MIGRATIONS_DIR}`);
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`Ambiguous match for "${arg}":\n  ${matches.join('\n  ')}`);
  process.exit(1);
}

const file = matches[0];
const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function run() {
  console.log(`Running migration: ${file}`);
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

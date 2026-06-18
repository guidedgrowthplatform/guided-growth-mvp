// One-off: reset a real user back to onboarding.
// Mirrors the table set from api/qa-reset.ts but accepts any email.
//
// Usage:
//   node scripts/reset-user-onboarding.mjs <email>          # dry-run (counts only)
//   node scripts/reset-user-onboarding.mjs <email> --apply  # actually delete

import pg from 'pg';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const email = process.argv[2];
const apply = process.argv.includes('--apply');
if (!email) {
  console.error('Usage: node scripts/reset-user-onboarding.mjs <email> [--apply]');
  process.exit(1);
}

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const { rows } = await client.query(
    `SELECT au.id AS user_id, p.anon_id, p.nickname, p.onboarding_path
       FROM auth.users au
       LEFT JOIN profiles p ON p.id = au.id
      WHERE au.email = $1`,
    [email.toLowerCase()],
  );
  if (!rows.length) {
    console.error(`User not found: ${email}`);
    await client.query('ROLLBACK');
    process.exit(2);
  }
  const { user_id, anon_id, nickname, onboarding_path } = rows[0];
  console.log('Matched user:', { user_id, anon_id, nickname, onboarding_path });

  if (!anon_id) {
    console.log('No anon_id on profile — nothing in anon-keyed tables to delete.');
  } else {
    const counts = {};
    for (const table of ['onboarding_states', 'user_habits', 'chat_messages', 'session_log', 'journal_entries', 'reflection_settings']) {
      const { rows: r } = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${table} WHERE anon_id = $1`,
        [anon_id],
      );
      counts[table] = r[0].n;
    }
    console.log('Row counts (will be deleted on --apply):', counts);
  }

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to execute.');
    await client.query('ROLLBACK');
    process.exit(0);
  }

  const deleted = {};
  if (anon_id) {
    for (const table of ['onboarding_states', 'user_habits', 'chat_messages', 'session_log', 'journal_entries', 'reflection_settings']) {
      const r = await client.query(`DELETE FROM ${table} WHERE anon_id = $1`, [anon_id]);
      deleted[table] = r.rowCount ?? 0;
    }
  }

  const prof = await client.query(
    `UPDATE profiles
        SET onboarding_path = NULL,
            nickname        = NULL,
            age_group       = NULL,
            gender          = NULL,
            referral_source = NULL
      WHERE id = $1`,
    [user_id],
  );
  deleted.profiles_updated = prof.rowCount ?? 0;

  await client.query('COMMIT');
  console.log('Applied. Deleted/updated:', deleted);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}

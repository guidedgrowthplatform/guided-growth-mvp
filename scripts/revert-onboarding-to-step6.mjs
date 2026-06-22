// Rewind a user's onboarding to the START of step 6 (reflection setup) WITHOUT
// wiping steps 1-5 (profile, category, goals, habits). Clears the step-6+ data
// (reflectionConfig, reflectionMode, customPrompts), reverts completion, drops
// the materialized reflection_settings row, and sets current_step = 6.
//
// Usage:
//   node scripts/revert-onboarding-to-step6.mjs <email>          # dry-run
//   node scripts/revert-onboarding-to-step6.mjs <email> --apply  # execute

import pg from 'pg';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const email = process.argv[2];
const apply = process.argv.includes('--apply');
if (!email) {
  console.error('Usage: node scripts/revert-onboarding-to-step6.mjs <email> [--apply]');
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
    `SELECT au.id AS user_id, p.anon_id, os.current_step, os.status, os.data
       FROM auth.users au
       LEFT JOIN profiles p ON p.id = au.id
       LEFT JOIN onboarding_states os ON os.anon_id = p.anon_id
      WHERE au.email = $1`,
    [email.toLowerCase()],
  );
  if (!rows.length) {
    console.error(`User not found: ${email}`);
    await client.query('ROLLBACK');
    process.exit(2);
  }
  const { anon_id, current_step, status, data } = rows[0];
  if (!anon_id) {
    console.error('No anon_id on profile.');
    await client.query('ROLLBACK');
    process.exit(2);
  }

  const d = data ?? {};
  console.log('Before:', {
    current_step,
    status,
    reflectionConfig: d.reflectionConfig ?? null,
    reflectionMode: d.reflectionMode ?? null,
    customPrompts: d.customPrompts ?? null,
  });

  if (!apply) {
    console.log(
      '\nDRY RUN — would set current_step=6, status=in_progress, clear reflectionConfig/reflectionMode/customPrompts, drop reflection_settings.\nRe-run with --apply.',
    );
    await client.query('ROLLBACK');
    process.exit(0);
  }

  const upd = await client.query(
    `UPDATE onboarding_states
        SET current_step = 6,
            status = 'in_progress',
            completed_at = NULL,
            data = (data - 'reflectionConfig' - 'reflectionMode' - 'customPrompts'),
            updated_at = now()
      WHERE anon_id = $1`,
    [anon_id],
  );
  const settings = await client.query(`DELETE FROM reflection_settings WHERE anon_id = $1`, [
    anon_id,
  ]);
  // Post-reflection runtime entries (journal_entry_fields cascades).
  const journals = await client.query(`DELETE FROM journal_entries WHERE anon_id = $1`, [anon_id]);

  await client.query('COMMIT');
  console.log('Applied:', {
    onboarding_states_updated: upd.rowCount ?? 0,
    reflection_settings_deleted: settings.rowCount ?? 0,
    journal_entries_deleted: journals.rowCount ?? 0,
    current_step: 6,
  });
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}

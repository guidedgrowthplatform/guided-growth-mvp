#!/usr/bin/env node
/**
 * Seeds ~10 preset QA users on STAGING Supabase with realistic history so
 * The Weekly coach has real material: habits, completions, check-ins, journal
 * entries, reflection_settings, and prior weekly_sessions.
 *
 * SAFETY: reads ONLY STAGING_* env vars. Hard-rejects any connection that
 * does not match the staging project ref.
 *
 * Usage:
 *   node scripts/qa/seed-weekly-presets.mjs [--plan]
 *
 *   --plan   Print what would be seeded and exit without connecting.
 *
 *   STAGING_SUPABASE_URL=https://ppyouymvnrqxcsllrmsl.supabase.co \
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY=<service_role> \
 *   STAGING_DATABASE_URL=postgresql://postgres.ppyouymvnrqxcsllrmsl:pw@... \
 *   QA_PASSWORD=<password> \
 *     node scripts/qa/seed-weekly-presets.mjs
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { isGapDay, completionStatus, dayStates } from './weeklyPresetPatterns.mjs';

const { Client } = pg;

// Staging project ref — the safety gate is keyed on this.
const EXPECTED_STAGING_REF = 'ppyouymvnrqxcsllrmsl'; // staging project ref

// ── --plan mode ──────────────────────────────────────────────────────────────

const IS_PLAN = process.argv.includes('--plan');

const PRESETS = [
  { slug: '1w-consistent',   days:  7 },
  { slug: '1w-inconsistent', days:  7 },
  { slug: '2w-mixed',        days: 14 },
  { slug: '2w-strongstart',  days: 14 },
  { slug: '3w-consistent',   days: 21 },
  { slug: '3w-gaps',         days: 21 },
  { slug: '1mo-consistent',  days: 28 },
  { slug: '1mo-inconsistent',days: 28 },
  { slug: '1mo-strongstart', days: 28 },
  { slug: '1mo-gaps',        days: 28 },
];

const HABITS = [
  { name: 'Morning walk',      habit_type: 'binary_build',  cadence: 'daily',   schedule_days: null },
  { name: 'Read 10 pages',     habit_type: 'binary_build',  cadence: 'daily',   schedule_days: null },
  { name: 'No phone after 10pm', habit_type: 'binary_break', cadence: 'daily',  schedule_days: null },
  { name: 'Workout',           habit_type: 'binary_build',  cadence: '3x/week', schedule_days: [1, 3, 5] },
];

function estimatePreset(slug, days) {
  let completions = 0, gapDays = 0, done = 0;
  for (let di = 0; di < days; di++) {
    if (isGapDay(slug, di)) { gapDays++; continue; }
    for (let hi = 0; hi < 4; hi++) {
      if (slug === '1mo-consistent' && hi === 3 && di < 14) continue;
      const s = completionStatus(slug, di, hi);
      if (s !== null) { completions++; if (s === 'done') done++; }
    }
  }
  const loggedDays = days - gapDays;
  const priorWeeks = Math.floor(days / 7) - 1;
  return { completions, done, loggedDays, gapDays, priorWeeks };
}

if (IS_PLAN) {
  console.log(`[seed] seed-weekly-presets — ${PRESETS.length} users (staging: ${EXPECTED_STAGING_REF})\n`);
  for (const { slug, days } of PRESETS) {
    const email = `qa-weekly-${slug}@guidedgrowth.test`;
    const { completions, done, loggedDays, gapDays, priorWeeks } = estimatePreset(slug, days);
    const pct = loggedDays > 0 ? Math.round((done / (completions || 1)) * 100) : 0;
    console.log(`  ${email}`);
    console.log(`    window: ${days}d | gap days: ${gapDays} | logged days: ${loggedDays} | habits: 4 | completions: ${done}/${completions} (${pct}%) | checkins: ${loggedDays} | journal: ${loggedDays} | prior weekly sessions: ${priorWeeks}\n`);
  }
  process.exit(0);
}

// ── env validation ────────────────────────────────────────────────────────────

const stagingUrl   = process.env.STAGING_SUPABASE_URL;
const stagingKey   = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const stagingDbUrl = process.env.STAGING_DATABASE_URL;
const qaPassword   = process.env.QA_PASSWORD;

if (!stagingUrl || !stagingKey || !stagingDbUrl || !qaPassword) {
  console.error(
    'Required env vars missing. Set:\n' +
    '  STAGING_SUPABASE_URL\n' +
    '  STAGING_SUPABASE_SERVICE_ROLE_KEY\n' +
    '  STAGING_DATABASE_URL\n' +
    '  QA_PASSWORD',
  );
  process.exit(1);
}
if (qaPassword.length < 6) {
  console.error('QA_PASSWORD must be at least 6 characters.');
  process.exit(1);
}

// Safety gate: reject any non-staging connection target.
function verifyStagingRef() {
  let supabaseHost, dbUser;
  try {
    supabaseHost = new URL(stagingUrl).hostname;
  } catch {
    console.error(`[gate] Cannot parse STAGING_SUPABASE_URL: ${stagingUrl}`);
    process.exit(1);
  }
  try {
    dbUser = new URL(stagingDbUrl).username;
  } catch {
    console.error(`[gate] Cannot parse STAGING_DATABASE_URL as a URL.`);
    process.exit(1);
  }

  const expectedSupabaseHost = `${EXPECTED_STAGING_REF}.supabase.co`;
  const expectedDbUser       = `postgres.${EXPECTED_STAGING_REF}`;

  if (supabaseHost !== expectedSupabaseHost) {
    console.error(
      `[gate] REJECTED: STAGING_SUPABASE_URL host is "${supabaseHost}",` +
      ` expected "${expectedSupabaseHost}". Refusing to write.`,
    );
    process.exit(1);
  }
  if (dbUser !== expectedDbUser) {
    console.error(
      `[gate] REJECTED: STAGING_DATABASE_URL user is "${dbUser}",` +
      ` expected "${expectedDbUser}". Refusing to write.`,
    );
    process.exit(1);
  }

  const dbHost = new URL(stagingDbUrl).hostname;
  console.log(`[seed] target verified: ${dbUser}@${dbHost} / ${supabaseHost}`);
}

verifyStagingRef();

// ── clients ───────────────────────────────────────────────────────────────────

const admin = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } });
const dbClient = new Client({ connectionString: stagingDbUrl });

// ── date utilities ────────────────────────────────────────────────────────────

function localDateStr(date) {
  return new Intl.DateTimeFormat('en-CA').format(date);
}

function subtractDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function dayIndexToDate(today, windowSize, dayIndex) {
  // dayIndex 0 = oldest; dayIndex windowSize-1 = today
  return subtractDays(today, windowSize - 1 - dayIndex);
}

// Whether habit[hi] is active for this day (1mo-consistent adds habit 3 midway)
function habitActiveForDay(slug, habitIndex, dayIndex) {
  if (slug === '1mo-consistent' && habitIndex === 3 && dayIndex < 14) return false;
  return true;
}

// ── journal content ───────────────────────────────────────────────────────────

const CONTENT_GOOD = [
  'Morning walk done — started the day feeling strong.',
  'Read my 10 pages before bed, kept the streak going.',
  'Stayed off my phone after 10pm, slept much better for it.',
  'Got the workout in despite being busy. Worth it.',
  'Checked all habits today. Energy was solid throughout.',
  'Good start to the day. Routine held.',
];
const CONTENT_BAD = [
  'Low energy today, skipped the workout but logged the day.',
  'Rough morning, did not finish reading. Try again tomorrow.',
  'Stress was high, could not stick to the no-phone rule.',
  'Missed the walk — late meeting ran over into the evening.',
  'Off day. Did not follow through on habits but noted it.',
];
const CONTENT_NEUTRAL = [
  'Decent day overall. Habits checked, mood was alright.',
  'Got through the routine, nothing extraordinary.',
  'Kept up with the plan. Evening felt calmer than usual.',
  'Mixed results today. Some habits done, some not.',
];

function journalContent(mainHabitDone, dayIndex) {
  if (mainHabitDone) return CONTENT_GOOD[dayIndex % CONTENT_GOOD.length];
  if (dayIndex % 3 === 0) return CONTENT_BAD[dayIndex % CONTENT_BAD.length];
  return CONTENT_NEUTRAL[dayIndex % CONTENT_NEUTRAL.length];
}

// ── pg int array serialization ────────────────────────────────────────────────

function pgIntArray(arr) {
  if (!arr || arr.length === 0) return null;
  return `{${arr.join(',')}}`;
}

// ── per-user seed ─────────────────────────────────────────────────────────────

async function resolveAnonId(userId) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const { rows } = await dbClient.query(
      'SELECT anon_id FROM profiles WHERE id = $1',
      [userId],
    );
    if (rows.length > 0) return rows[0].anon_id;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Profile row not found for auth user ${userId} after 12 attempts`);
}

async function seedPreset(preset, existingUserMap, today) {
  const { slug, days } = preset;
  const email = `qa-weekly-${slug}@guidedgrowth.test`;

  // 1. Create or reset auth user.
  let userId;
  const existingId = existingUserMap.get(email.toLowerCase());
  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password: qaPassword,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUser failed for ${email}: ${error.message}`);
    userId = existingId;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: qaPassword,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser failed for ${email}: ${error.message}`);
    userId = data.user.id;
  }

  // 2. Resolve anon_id (trigger may be slightly async).
  const anonId = await resolveAnonId(userId);

  // 3. Transaction: wipe previous seed + re-insert.
  await dbClient.query('BEGIN');
  try {
    // Delete in FK-safe order.
    await dbClient.query(
      `DELETE FROM journal_entry_fields
       WHERE entry_id IN (SELECT id FROM journal_entries WHERE anon_id = $1)`,
      [anonId],
    );
    await dbClient.query('DELETE FROM journal_entries    WHERE anon_id = $1', [anonId]);
    await dbClient.query('DELETE FROM habit_completions  WHERE anon_id = $1', [anonId]);
    await dbClient.query('DELETE FROM user_habits        WHERE anon_id = $1', [anonId]);
    await dbClient.query('DELETE FROM daily_checkins     WHERE anon_id = $1', [anonId]);
    await dbClient.query('DELETE FROM reflection_settings WHERE anon_id = $1', [anonId]);
    await dbClient.query('DELETE FROM weekly_sessions    WHERE anon_id = $1', [anonId]);

    // Insert habits.
    const habitIds = [];
    for (let hi = 0; hi < 4; hi++) {
      const h = HABITS[hi];
      // 1mo-consistent: habit 3 added midway through the window.
      const createdAt = (slug === '1mo-consistent' && hi === 3)
        ? subtractDays(today, 14)
        : subtractDays(today, days + 5);
      const { rows } = await dbClient.query(
        `INSERT INTO user_habits
           (anon_id, name, habit_type, cadence, schedule_days, is_active, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7)
         RETURNING id`,
        [anonId, h.name, h.habit_type, h.cadence, pgIntArray(h.schedule_days), hi, createdAt],
      );
      habitIds.push(rows[0].id);
    }

    // Daily rows.
    let prevSleep = null;
    let completionCount = 0, checkinCount = 0, journalCount = 0;

    for (let di = 0; di < days; di++) {
      if (isGapDay(slug, di)) { prevSleep = null; continue; }

      const dateStr = dayIndexToDate(today, days, di);

      // Completions.
      const mainStatus = completionStatus(slug, di, 0);
      const mainHabitDone = mainStatus === 'done';

      for (let hi = 0; hi < 4; hi++) {
        if (!habitActiveForDay(slug, hi, di)) continue;
        const status = completionStatus(slug, di, hi);
        if (status !== null) {
          await dbClient.query(
            `INSERT INTO habit_completions (anon_id, habit_id, date, status)
             VALUES ($1, $2, $3, $4)`,
            [anonId, habitIds[hi], dateStr, status],
          );
          completionCount++;
        }
      }

      // Check-in (correlated with habit status and sleep lag).
      const states = dayStates(slug, di, prevSleep, mainHabitDone);
      await dbClient.query(
        `INSERT INTO daily_checkins (anon_id, date, sleep, mood, energy, stress)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [anonId, dateStr, states.sleep, states.mood, states.energy, states.stress],
      );
      checkinCount++;
      prevSleep = states.sleep;

      // Journal entry.
      const content = journalContent(mainHabitDone, di);
      const { rows: entryRows } = await dbClient.query(
        `INSERT INTO journal_entries (anon_id, type, date)
         VALUES ($1, 'freeform', $2) RETURNING id`,
        [anonId, dateStr],
      );
      await dbClient.query(
        `INSERT INTO journal_entry_fields (entry_id, field_key, content)
         VALUES ($1, 'body', $2)`,
        [entryRows[0].id, content],
      );
      journalCount++;
    }

    // Reflection settings: weekly_day = today's day-of-week so The Weekly runs now.
    const weeklyDay = new Date().getDay();
    await dbClient.query(
      `INSERT INTO reflection_settings
         (anon_id, mode, prompts, schedule_days, reminder_enabled, weekly_day)
       VALUES ($1, 'freeform', '[]'::jsonb, '[]'::jsonb, false, $2)`,
      [anonId, weeklyDay],
    );

    // Prior completed weekly_sessions (one per full completed week before today).
    const priorWeeks = Math.floor(days / 7) - 1;
    const focusOptions = [
      'Get the morning walk consistent',
      'Sleep before midnight every night',
      'Keep reading streak above 80%',
      'Build the workout to 3x/week',
    ];
    for (let w = 0; w < priorWeeks; w++) {
      const weekEnd   = subtractDays(today, (w + 1) * 7);
      const weekStart = subtractDays(weekEnd, 6);
      const focus     = focusOptions[w % focusOptions.length];
      await dbClient.query(
        `INSERT INTO weekly_sessions
           (anon_id, week_start, week_end, completed_at, focus, changes, insights)
         VALUES ($1, $2, $3, now(), $4, '[]'::jsonb, '[]'::jsonb)`,
        [anonId, weekStart, weekEnd, focus],
      );
    }

    // Mark user as onboarded so the QA screen dropdown shows them correctly.
    await dbClient.query(
      `UPDATE profiles SET onboarding_path = 'beginner', nickname = $2 WHERE anon_id = $1`,
      [anonId, slug],
    );

    await dbClient.query('COMMIT');

    console.log(
      `[seed] ${email} | ${days}d | 4 habits | ` +
      `${completionCount} completions | ${checkinCount} checkins | ` +
      `${journalCount} journal | ${priorWeeks} prior weekly sessions`,
    );
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  await dbClient.connect();

  // Build existing-user map (up to 5 pages).
  const existingUserMap = new Map();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const u of data.users) {
      if (u.email) existingUserMap.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 200) break;
  }

  const today = localDateStr(new Date());
  console.log(`[seed] run date: ${today} | weekly_day: ${new Date().getDay()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]})`);

  let seeded = 0, failed = 0;
  for (const preset of PRESETS) {
    try {
      await seedPreset(preset, existingUserMap, today);
      seeded++;
    } catch (err) {
      console.error(`[seed] FAIL qa-weekly-${preset.slug}@guidedgrowth.test: ${err.message}`);
      failed++;
    }
  }

  await dbClient.end();
  console.log(`\n[seed] done — ${seeded} seeded, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Creates the five QA test accounts the /onboarding/qa control screen logs in as.
 * One per tester. Emails follow qa-onboarding-*@guidedgrowth.test so the existing
 * reset endpoints accept them. Accounts are created with email auto-confirmed
 * (the .test domain can't receive a confirmation mail) and share one password.
 *
 * The profile row (with anon_id) is created by the app's signup trigger; this
 * script only creates the auth.users account. Idempotent: skips users that exist.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... QA_PASSWORD=... \
 *     node scripts/qa/create-test-users.mjs
 *
 * Get the service role key from the Supabase dashboard (Project settings > API).
 * Pick a QA_PASSWORD and stash it (you'll also set it as VITE_QA_PASSWORD on the
 * QA build so the screen can sign in).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Same value must be set as VITE_QA_PASSWORD on the QA build so the screen signs in.
const password = process.env.QA_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error(
    'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and QA_PASSWORD (e.g. node --env-file=.env.local).',
  );
  process.exit(1);
}
if (password.length < 6) {
  console.error('QA_PASSWORD must be at least 6 characters.');
  process.exit(1);
}

const EMAILS = [
  'qa-onboarding-yair@guidedgrowth.test',
  'qa-onboarding-alejandro@guidedgrowth.test',
  'qa-onboarding-yonas@guidedgrowth.test',
  'qa-onboarding-mintesnot@guidedgrowth.test',
  'qa-onboarding-timothy@guidedgrowth.test',
];

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Map existing emails to ids so an account that already exists gets its password
// set to the shared value (otherwise login would fail with its old password).
// Only the EMAILS below are ever touched, so other qa-onboarding-* accounts are safe.
const existing = new Map();
for (let page = 1; page <= 5; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error || !data) break;
  for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
  if (data.users.length < 200) break;
}

for (const email of EMAILS) {
  const id = existing.get(email.toLowerCase());
  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
    console.log(error ? `FAIL  ${email}: ${error.message}` : `set   ${email} (existing, password synced)`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    console.log(error ? `FAIL  ${email}: ${error.message}` : `made  ${email} (${data.user?.id})`);
  }
}
console.log('Done. All five accounts now use the provided QA_PASSWORD.');

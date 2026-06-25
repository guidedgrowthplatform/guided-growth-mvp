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
const password = process.env.QA_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and QA_PASSWORD.');
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

for (const email of EMAILS) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    const exists = /already.*registered|exists/i.test(error.message);
    console.log(`${exists ? 'skip ' : 'FAIL '} ${email}${exists ? ' (exists)' : ': ' + error.message}`);
  } else {
    console.log(`made  ${email}  (${data.user?.id})`);
  }
}
console.log('Done. Set VITE_QA_PASSWORD to the same QA_PASSWORD on the QA build.');

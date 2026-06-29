#!/usr/bin/env node
/**
 * Sets (or creates) the password on ONE qa-onboarding-* test account, so a tester
 * can self-serve VITE_QA_PASSWORD without waiting on whoever first ran
 * create-test-users.mjs. Unlike that script (idempotent-skip, can't rotate a
 * password), this UPDATES an existing account's password via updateUserById.
 *
 * Guarded: only emails matching ^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$ are
 * ever touched — never a real user.
 *
 * Run (defaults to the yonas account):
 *   set -a && . ./.env.local && set +a && \
 *     QA_PASSWORD=YourPick node scripts/qa/qa-set-password.mjs
 *
 * Or target a different tester:
 *   ... QA_EMAIL=qa-onboarding-yonas@guidedgrowth.test QA_PASSWORD=YourPick node scripts/qa/qa-set-password.mjs
 *
 * Then set VITE_QA_PASSWORD to the same value in .env.local and restart `npm run dev`.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.QA_PASSWORD;
const email = (process.env.QA_EMAIL || 'qa-onboarding-yonas@guidedgrowth.test').toLowerCase();

const QA_EMAIL_PATTERN = /^qa-onboarding-[a-z0-9-]+@guidedgrowth\.test$/;

if (!url || !serviceKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and QA_PASSWORD (source .env.local first).');
  process.exit(1);
}
if (!QA_EMAIL_PATTERN.test(email)) {
  console.error(`Refusing: ${email} is not a qa-onboarding-*@guidedgrowth.test address.`);
  process.exit(1);
}
if (password.length < 6) {
  console.error('QA_PASSWORD must be at least 6 characters.');
  process.exit(1);
}

console.log(`Targeting ${email} on ${new URL(url).host} ...`);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Find the account by paging auth.users (test-account volume is tiny).
async function findUserId(targetEmail) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === targetEmail);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

const existingId = await findUserId(email);

if (existingId) {
  const { error } = await admin.auth.admin.updateUserById(existingId, { password });
  if (error) {
    console.error(`FAIL update ${email}: ${error.message}`);
    process.exit(1);
  }
  console.log(`updated password  ${email}  (${existingId})`);
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error(`FAIL create ${email}: ${error.message}`);
    process.exit(1);
  }
  console.log(`created  ${email}  (${data.user?.id})`);
}

console.log('Done. Set VITE_QA_PASSWORD to the same value in .env.local, then restart `npm run dev`.');

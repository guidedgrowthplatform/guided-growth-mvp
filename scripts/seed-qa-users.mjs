// Seed the 5 dedicated QA test accounts. Idempotent — re-running is a no-op for
// existing users. Run against STAGING only.
//
// Usage:
//   node scripts/seed-qa-users.mjs          # dry-run (prints target + plan)
//   node scripts/seed-qa-users.mjs --apply  # create missing accounts

import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const apply = process.argv.includes('--apply');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const QA_USERS = [
  { name: 'Mintesnot', email: 'qa-mintesnot@guidedgrowth.test' },
  { name: 'Yonas', email: 'qa-yonas@guidedgrowth.test' },
  { name: 'Yair', email: 'qa-yair@guidedgrowth.test' },
  { name: 'Timothy', email: 'qa-timothy@guidedgrowth.test' },
  { name: 'Alejandro', email: 'qa-alejandro@guidedgrowth.test' },
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log(`Target: ${SUPABASE_URL}`);
console.log(`Accounts: ${QA_USERS.map((u) => u.email).join(', ')}`);
if (!apply) {
  console.log('\nDry-run. Re-run with --apply to create missing accounts.');
  process.exit(0);
}

// Never seed prod test accounts unless deliberately overridden.
if (SUPABASE_URL.includes('pmunbflbjpoawicgimyc') && process.env.ALLOW_PROD !== '1') {
  console.error('\n✗ Refusing to seed PRODUCTION. Set ALLOW_PROD=1 to override.');
  process.exit(1);
}

let created = 0;
let existed = 0;
for (const { name, email } of QA_USERS) {
  // Random password — never used; quick-login mints sessions via magiclink.
  const password = `qa-${crypto.randomUUID()}`;
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, nickname: name },
  });
  if (error) {
    if (/already.*registered|already.*exists/i.test(error.message)) {
      existed++;
      console.log(`= ${email} (already exists)`);
    } else {
      console.error(`✗ ${email}: ${error.message}`);
    }
  } else {
    created++;
    console.log(`+ ${email}`);
  }
}

console.log(`\nDone. created=${created} existed=${existed}`);
process.exit(0);

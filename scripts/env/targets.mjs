// Shared knowledge of which Supabase project is which, plus a prod guard.
// Refs are not secret — they're the public project subdomains.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');

export const PROJECT_REFS = {
  prod: 'pmunbflbjpoawicgimyc',
  staging: 'ppyouymvnrqxcsllrmsl',
};

function classify(text) {
  if (!text) return 'unknown';
  for (const [name, ref] of Object.entries(PROJECT_REFS)) {
    if (text.includes(ref)) return name;
  }
  return 'unknown';
}

// Which project the LIVE connection points at — reads the resolved env
// (DATABASE_URL / SUPABASE_URL), so it guards the real target regardless of
// whether it came from .env.local or an inline override.
export function resolveTargetFromEnv() {
  return classify(`${process.env.DATABASE_URL ?? ''} ${process.env.SUPABASE_URL ?? ''}`);
}

// Which project a dotenv file points at — for the switch script's reporting.
export function resolveTargetFromFile(file = resolve(REPO_ROOT, '.env.local')) {
  try {
    return classify(readFileSync(file, 'utf8'));
  } catch {
    return 'unknown';
  }
}

// Refuse destructive scripts against prod unless explicitly allowed. Call AFTER
// dotenv has loaded so the resolved DATABASE_URL is what's actually checked.
export function assertSafeTarget(action = 'this operation') {
  const target = resolveTargetFromEnv();
  if (target === 'prod' && process.env.ALLOW_PROD !== '1') {
    console.error(
      `\n✗ Refusing ${action}: target is PRODUCTION (${PROJECT_REFS.prod}).\n` +
        `  Switch with \`npm run env:staging\`, or set ALLOW_PROD=1 to override deliberately.\n`,
    );
    process.exit(1);
  }
  return target;
}

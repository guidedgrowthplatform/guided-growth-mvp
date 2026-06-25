// Switch the active .env.local between stored per-environment templates.
//
// Usage:
//   npm run env:staging          # safe default for local dev
//   npm run env:prod             # prompts; pointing local at prod is deliberate
//
// Templates (gitignored, you fill once): .env.staging.local, .env.prod.local

import { copyFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { REPO_ROOT, resolveTargetFromFile, PROJECT_REFS } from './targets.mjs';

const target = process.argv[2];
if (target !== 'staging' && target !== 'prod') {
  console.error('Usage: node scripts/env/switch-env.mjs <staging|prod>');
  process.exit(1);
}

const src = resolve(REPO_ROOT, `.env.${target}.local`);
const dest = resolve(REPO_ROOT, '.env.local');

if (!existsSync(src)) {
  console.error(`✗ Missing ${src}\n  Copy .env.local.example to it and fill the values.`);
  process.exit(1);
}

const text = readFileSync(src, 'utf8');
if (/REPLACE_WITH_/.test(text)) {
  console.error(`✗ ${src} still has REPLACE_WITH_ placeholders — fill them before switching.`);
  process.exit(1);
}

if (target === 'prod' && process.argv[3] !== '--yes-prod') {
  console.error(
    '✗ Refusing to point local at PRODUCTION without confirmation.\n' +
      '  Re-run: node scripts/env/switch-env.mjs prod --yes-prod',
  );
  process.exit(1);
}

copyFileSync(src, dest);
const resolved = resolveTargetFromFile(dest);
console.log(`✓ .env.local now → ${target} (${PROJECT_REFS[resolved] ?? 'unknown ref'})`);

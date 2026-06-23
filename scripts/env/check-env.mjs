#!/usr/bin/env node
// Validate Vercel env scopes against scripts/env/required-env.json.
// Usage: node scripts/env/check-env.mjs <scope> [envFile]
//   scope: production | preview
//   envFile: optional source (default: process.env). Accepts either a dotenv
//     file (KEY=value) OR a names list (one KEY per line). Names-list mode is
//     required for sensitive vars, which `vercel env pull` returns empty.
// Fail-closed: missing required var OR forbidden-in-prod var => exit 1.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(readFileSync(join(here, 'required-env.json'), 'utf8'));

const scope = process.argv[2];
const envFile = process.argv[3];

if (!scope || !matrix.scopes[scope]) {
  console.error(`usage: check-env.mjs <${Object.keys(matrix.scopes).join('|')}> [envFile]`);
  process.exit(2);
}

function parseEnvSource(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const kv = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (kv) {
      out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
      continue;
    }
    const name = line.match(/^([A-Z0-9_]+)$/i);
    if (name) out[name[1]] = '1'; // names-list mode: presence only
  }
  return out;
}

const env = envFile ? parseEnvSource(readFileSync(envFile, 'utf8')) : process.env;
const present = (k) => env[k] !== undefined && env[k] !== '';

const errors = [];

for (const key of matrix.scopes[scope].required) {
  if (!present(key)) errors.push(`MISSING required ${key} in ${scope}`);
}

if (scope === 'production') {
  for (const key of matrix.forbiddenInProduction) {
    if (present(key))
      errors.push(`FORBIDDEN ${key} present in production (QA-only var must never ship to prod)`);
  }
}

if (errors.length) {
  console.error(`env-matrix check FAILED for scope=${scope}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`env-matrix check OK for scope=${scope}`);

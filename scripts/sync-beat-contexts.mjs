// Rebind each active onboarding beat's `context` in beatsSource.ts from the
// Master Sheet "Beats Context" tab (beat-contexts-from-sheet.json), the correct
// source. The prior values were wrongly sourced from the dead Vapi-era
// screen_contexts.json. Idempotent: run it repeatedly, only `context` changes.
//
// Usage: node scripts/sync-beat-contexts.mjs
//
// - Binds ONLY active beats matched by screenId.
// - SKIPs known-dead screenIds (see SKIP_SCREEN_IDS).
// - Leaves context untouched (and reports it) for beats with no sheet row.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BEATS_PATH = resolve(__dirname, '../src/components/flow-designer/beatsSource.ts');
const SHEET_PATH = resolve(
  __dirname,
  '../../claude-work/render-onesource/beat-contexts-from-sheet.json',
);

// Dead onboarding screenIds: never rebind, leave as-is.
const SKIP_SCREEN_IDS = new Set([
  'ONBOARD-BEGINNER-05',
  'ONBOARD-BEGINNER-06',
  'ONBOARD-ADVANCED-02',
  'ONBOARD-ADVANCED-04',
  'ONBOARD-ADVANCED-05',
  'ONBOARD-ADV-CUSTOM',
]);

// Extract the BEATS_SOURCE array literal (string-aware bracket matching so
// brackets inside context text do not confuse the scan).
function locateArray(src) {
  const decl = src.indexOf('export const BEATS_SOURCE');
  if (decl < 0) throw new Error('BEATS_SOURCE declaration not found');
  const start = src.indexOf('= [', decl) + 2;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return { start, end: i };
    }
  }
  throw new Error('BEATS_SOURCE array end not found');
}

const src = readFileSync(BEATS_PATH, 'utf8');
const sheet = JSON.parse(readFileSync(SHEET_PATH, 'utf8'));
const { start, end } = locateArray(src);
const literal = src.slice(start, end + 1);
const beats = JSON.parse(literal);

const rebound = [];
const skippedDead = [];
const gaps = [];
let changed = 0;

for (const beat of beats) {
  const sid = beat.screenId;
  if (!sid) {
    gaps.push(`${beat.id} (no screenId)`);
    continue;
  }
  if (SKIP_SCREEN_IDS.has(sid)) {
    skippedDead.push(`${beat.id} -> ${sid}`);
    continue;
  }
  const row = sheet[sid];
  if (!row || typeof row.context !== 'string') {
    gaps.push(`${beat.id} -> ${sid} (no sheet row)`);
    continue;
  }
  if (beat.context !== row.context) changed++;
  beat.context = row.context;
  rebound.push(`${beat.id} -> ${sid}`);
}

const nextLiteral = JSON.stringify(beats, null, 2);
const nextSrc = src.slice(0, start) + nextLiteral + src.slice(end + 1);
writeFileSync(BEATS_PATH, nextSrc);

// GLOBAL is the coach persona sent every turn. There is no home for it in
// beatsSource (no persona/global field) and the render has no global-context
// store, so it is NOT bound here. See the report / TODO below.
const hasGlobal = typeof sheet.GLOBAL?.context === 'string';

console.log(`Rebound ${rebound.length} beat context(s), ${changed} changed:`);
for (const r of rebound) console.log(`  + ${r}`);
console.log(`\nSkipped dead (${skippedDead.length}):`);
for (const s of skippedDead) console.log(`  - ${s}`);
console.log(`\nGaps, left unchanged (${gaps.length}):`);
for (const g of gaps) console.log(`  ? ${g}`);
console.log(
  `\nGLOBAL persona context present in sheet: ${hasGlobal ? 'yes' : 'no'}. NOT bound (no global-context home in beatsSource / render). TODO: add a persona store if the render should surface it.`,
);

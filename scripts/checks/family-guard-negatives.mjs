// FAMILY-GUARD NEGATIVE TESTS (Codex G1/G2 re-gate, 2026-07-10).
//
// These are committed adversarial tests that prove the family typed-path guard in
// scripts/bible-registry-check.mjs actually BITES on the two holes Codex found. They
// run the SAME command CI gates on (`node scripts/bible-registry-check.mjs`, i.e.
// `npm run check:rules-registry`, a member of `check:beats`), NOT Vitest — the point
// of the re-gate is that the integrity check lives in the guard command, not a
// Vitest-only assertion the CI job never runs.
//
// Each test: back up the real source, apply a surgical mutation on disk, run the
// guard, assert it FAILS with the expected diagnostic, then ALWAYS restore. A
// baseline test also confirms the guard PASSES on the clean tree.
//
//   Test A (G1): goalsSemanticTokens() -> ['harmless-token'] + the typed rules
//     builder forced to n = 'sleep'. Before the fix the guard exited 0 (nonempty
//     token set trusted by length) while the resolver leaked 28 real Sleep tokens.
//     After the fix the FAMILY CONTRACT integrity check rejects the drifted token
//     set (exported != canonical).
//
//   Test B (G2): a variant (goals-organize) that authors only a manifest bible while
//     inheriting a category-sensitive head section via free-text substitution. Before
//     the fix `if (v.hasOwnBible) continue` skipped it wholesale in the family loop,
//     so a FAMILY GUARD substitution diagnostic could NEVER be emitted for a
//     bible-owning variant. After the fix the substitution-path guard flags it. The
//     presence of that diagnostic for a hasOwnBible variant is the unique fingerprint
//     of the fix.
//
//   Test C (H1): a habits per-goal variant whose rebuilt rulesCode reuses the EXACT
//     generic head rule id 'h-tools-only'. The habits head prefix 'h' (<3 chars) is
//     too short for the broad substring scan and the id is not a substring of any
//     legitimate child id, so it slipped both the registry and tool-contract checks.
//     After the fix the EXACT head-rule-id rejection (independent of prefix length)
//     flags it; the "emits EXACT head rule id" diagnostic is the fingerprint.
//
//   Test D (category token-drift): the category-grid head's exported semantic-token
//     set drifted away from the canonical set recomputed from categoryData. The
//     FAMILY CONTRACT integrity check must reject it (exported != canonical), proving
//     the family-contract guard covers the category family, not only goals.
//
//   Test E (cross-beat rule-id duplicate, Fable residual): category-women AUTHORS its
//     own bible, so the per-beat exact-head-rule-id rejection (3b, derived-sections
//     only) never inspects it. Point its authored rulesCode id 'catw-tools-only' at the
//     head's 'cat-tools-only' and — before the (3d) global cross-beat uniqueness check —
//     it passed both the registry and tool-contract checks. After the fix, (3d) rejects
//     the same rule id claimed by two beats; the "CROSS-BEAT RULE-ID" diagnostic naming
//     both beats is the fingerprint.
//
// Run: `node scripts/checks/family-guard-negatives.mjs` (or `npm run check:family-guard-negatives`).
// Exits 0 only if the guard behaved correctly on all cases (green clean, red on both
// mutations). This is NOT part of `check:beats` (which must stay green); it is the
// proof harness that the guard rejects what it must.

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const beatsPath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const guardScript = path.join('scripts', 'bible-registry-check.mjs');

function runGuard() {
  const r = spawnSync('node', [guardScript], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// Apply an ordered list of [find, replace] edits to a string; throw if any anchor
// is missing (a moved anchor must fail loudly, never silently no-op the test).
function mutate(src, edits) {
  let out = src;
  for (const [find, replace] of edits) {
    if (!out.includes(find)) throw new Error(`anchor not found:\n${find}`);
    out = out.replace(find, replace);
  }
  return out;
}

let failures = 0;
const original = readFileSync(beatsPath, 'utf8');

function withMutation(name, edits, assertFn) {
  let result;
  try {
    writeFileSync(beatsPath, mutate(original, edits), 'utf8');
    result = runGuard();
  } finally {
    writeFileSync(beatsPath, original, 'utf8'); // always restore
  }
  try {
    assertFn(result);
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}: ${e.message}`);
    console.log(`        guard exit=${result.code}, output tail:`);
    console.log(
      result.out
        .split('\n')
        .filter((l) => l.trim())
        .slice(-8)
        .map((l) => `        | ${l}`)
        .join('\n'),
    );
  }
}

console.log('FAMILY-GUARD NEGATIVE TESTS (Codex G1/G2 + H1 rule-id + category drift)\n');

// Baseline: clean tree must PASS.
{
  const { code } = runGuard();
  if (code === 0) console.log('  PASS  baseline: clean tree passes the guard');
  else {
    failures += 1;
    console.log(`  FAIL  baseline: clean tree should pass but guard exited ${code}`);
  }
}

// Test A (G1): junk exported tokens + lowercase-Sleep rules builder.
withMutation(
  'G1 junk-token attack fails the guard (FAMILY CONTRACT)',
  [
    // A1: goalsSemanticTokens() always returns a nonempty JUNK set.
    [
      '  const data = goalsCategoryData[category];\n  if (!data) return [];',
      "  const data = goalsCategoryData[category];\n  if (!data) return [];\n  return ['harmless-token']; // ADVERSARIAL MUTATION (G1 negative test)",
    ],
    // A2: the typed rules builder reintroduces the head Sleep noun for every category.
    ['const n = data.noun;', "const n = 'sleep'; // ADVERSARIAL MUTATION (G1 negative test)"],
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — junk token set was accepted');
    if (!/FAMILY CONTRACT/.test(out))
      throw new Error('guard failed but not via the FAMILY CONTRACT integrity check');
    if (!/does NOT match the/.test(out))
      throw new Error('FAMILY CONTRACT diagnostic did not report the exported/canonical mismatch');
  },
);

// Test B (G2): a bible-owning variant that inherits a category-sensitive head
// section via substitution. Switch goals-organize away from the goals-list typed
// path (so rulesContext/conversation/flow/edges fall to substituteDeep) and give it
// a manifest-only bible (so hasOwnBible is true). The old `if (v.hasOwnBible)
// continue` would skip it; the fixed guard flags the substitution path.
withMutation(
  'G2 manifest-owning variant on the substitution path fails the guard (FAMILY GUARD)',
  [
    [
      "    id: 'goals-organize',\n    name: 'Goals (Get more organized)',\n    order: 20,\n    path: 'beginner',\n    type: 'goals-list',\n    variantOf: 'goals-sleep',",
      "    id: 'goals-organize',\n    name: 'Goals (Get more organized)',\n    order: 20,\n    path: 'beginner',\n    type: 'category',\n    variantOf: 'goals-sleep',\n    bible: { sectionManifest: {} }, // ADVERSARIAL MUTATION (G2 negative test): owns only a manifest",
    ],
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — manifest-owning inheriting variant was accepted');
    // The UNIQUE fingerprint of the G2 fix: a FAMILY GUARD substitution diagnostic
    // emitted for goals-organize, a hasOwnBible variant the old code skipped.
    if (!/FAMILY GUARD: variant "goals-organize"/.test(out))
      throw new Error('the G2 substitution-path guard did not flag the manifest-owning variant');
    if (!/via free-text substitution/.test(out))
      throw new Error('G2 diagnostic did not identify the free-text substitution path');
  },
);

// Test C (H1): a habits per-goal variant whose rebuilt rulesCode reuses an EXACT
// generic head rule id ('h-tools-only') instead of its own per-goal id. The habits
// head prefix is 'h' (<3 chars), too short for the broad substring prefix scan, and
// the generic head rule id is not a substring of any legitimate child id — so before
// the exact-match rejection this passed both the registry and tool-contract checks
// green (Codex H1). The fixed guard rejects it by exact string match, independent of
// the head prefix length. The UNIQUE fingerprint of the fix is the "emits EXACT head
// rule id" diagnostic on the derived rulesCode section.
withMutation(
  'H1 habits child rulesCode reusing an exact head rule id fails the guard (rule-id leak)',
  [['      id: `${p}-tools-only`,', "      id: 'h-tools-only', // ADVERSARIAL MUTATION (H1 negative test)"]],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — an exact head rule id in a rebuilt child rulesCode was accepted');
    if (!/emits EXACT head rule id "h-tools-only"/.test(out))
      throw new Error('the H1 exact-rule-id rejection did not fire on the rebuilt rulesCode');
    if (!/derived section 'rulesCode'/.test(out))
      throw new Error('H1 diagnostic did not identify the rebuilt rulesCode section');
  },
);

// Test D (category token-drift): the category-grid head exports categorySemanticTokens()
// (its generic opener clip). Drift that exported set away from the canonical set the
// guard recomputes from categoryData, and the FAMILY CONTRACT integrity check must
// reject it (exported != canonical) — proving the family-contract guard covers the
// category family, not only goals. Its sole variant (category-women) authors its own
// bible and derives nothing, so the mismatch surfaces solely as a FAMILY CONTRACT
// failure, not a leak-scan hit.
withMutation(
  'category token-drift attack fails the guard (FAMILY CONTRACT)',
  [
    [
      'export function categorySemanticTokens(): readonly string[] {\n  return [categoryData.headClip];\n}',
      "export function categorySemanticTokens(): readonly string[] {\n  return ['drift-token']; // ADVERSARIAL MUTATION (category token-drift negative test)\n}",
    ],
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — a drifted category token set was accepted');
    if (!/FAMILY CONTRACT/.test(out))
      throw new Error('guard failed but not via the FAMILY CONTRACT integrity check');
    if (!/head "category"/.test(out))
      throw new Error('FAMILY CONTRACT diagnostic did not name the category family');
    if (!/does NOT match the/.test(out))
      throw new Error('FAMILY CONTRACT diagnostic did not report the exported/canonical mismatch');
  },
);

// Test E (cross-beat rule-id duplicate): an AUTHORED variant reusing an exact peer/head
// rule id. category-women authors its own bible, so the derived-section scans never see
// it; only the (3d) global cross-beat uniqueness check catches it.
withMutation(
  'E cross-beat duplicate authored rule id fails the guard (CROSS-BEAT RULE-ID)',
  [["      id: 'catw-tools-only',", "      id: 'cat-tools-only', // ADVERSARIAL MUTATION (cross-beat rule-id negative test)"]],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — an authored variant reusing a peer beat rule id was accepted');
    if (!/CROSS-BEAT RULE-ID: rule id "cat-tools-only"/.test(out))
      throw new Error('the (3d) cross-beat uniqueness check did not flag the duplicate rule id');
    if (!/\[category, category-women\]/.test(out))
      throw new Error('the CROSS-BEAT RULE-ID diagnostic did not name both claiming beats');
  },
);

console.log('');
if (failures) {
  console.log(`FAMILY-GUARD NEGATIVE TESTS: ${failures} failure(s).`);
  process.exit(1);
}
console.log(
  'FAMILY-GUARD NEGATIVE TESTS: all passed (guard bites on G1, G2, H1 rule-id leak, category token-drift, and cross-beat rule-id duplicate).',
);

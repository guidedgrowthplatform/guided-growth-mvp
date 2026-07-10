// GLOBAL-RESPONSE NEGATIVE TESTS (Codex B1 re-gate, 2026-07-10).
//
// Committed adversarial tests proving the B1-R guard in audio-ownership-check.mjs
// (lanes f + g, backed by scripts/checks/lib/globalVoiceOwnership.mjs) actually BITES
// on the hole Codex found: a global spoken reply added as free-text GlobalRule.rule
// prose with no `voice` field and no GLOBAL_VOICE_OWNERSHIP entry used to pass both
// audio-ownership and the registry, so prescribed spoken global behavior could be
// added with no owner while every gate stayed green.
//
// They run the SAME command CI gates on (`node scripts/checks/audio-ownership-check.mjs`,
// i.e. `npm run check:audio-ownership`, a member of `check:beats`), NOT Vitest — the
// point of the re-gate is that the integrity guard lives in the check:beats command,
// not a Vitest-only assertion the CI job never runs.
//
// Each test: back up the real flowBible.ts, apply a surgical on-disk mutation, run the
// guard, assert it FAILS with the expected diagnostic, then ALWAYS restore. A baseline
// test also confirms the guard PASSES on the clean tree.
//
//   Test A (B1 probe): the EXACT Codex probe — a GLOBAL_RULES entry
//     'glob-unregistered-spoken-probe' whose `rule` prose prescribes a spoken coach
//     line (say "...") with no `voice` field and no registry entry. Before the fix both
//     audio-ownership and the registry exited 0. After the fix the prose lint (lane g)
//     rejects it. The "prescribes a spoken coach line" diagnostic naming the probe is
//     the fingerprint.
//   Test B (spoken response with no owner): a GLOBAL_RESPONSES modality:'spoken' row
//     stripped of its `voice` owner. Lane f rejects it (every spoken response must be
//     owned).
//   Test C (spoken response outside the registry): a NEW GLOBAL_RESPONSES spoken row
//     with a legal voice but no matching GLOBAL_VOICE_OWNERSHIP entry. Lane f set-
//     equality rejects it (no spoken response may live outside the ownership registry).
//
// Run: `node scripts/checks/global-response-negatives.mjs` (or
// `npm run check:global-response-negatives`). Exits 0 only if the guard behaved
// correctly on all cases (green clean, red on every mutation). This is NOT part of
// `check:beats` (which must stay green); it is the proof harness that the guard rejects
// what it must.

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const flowBiblePath = path.join(root, 'src/components/flow-designer/flowBible.ts');
const guardScript = path.join('scripts', 'checks', 'audio-ownership-check.mjs');

function runGuard() {
  const r = spawnSync('node', [guardScript], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function mutate(src, edits) {
  let out = src;
  for (const [find, replace] of edits) {
    if (!out.includes(find)) throw new Error(`anchor not found:\n${find}`);
    out = out.replace(find, replace);
  }
  return out;
}

let failures = 0;
const original = readFileSync(flowBiblePath, 'utf8');

function withMutation(name, edits, assertFn) {
  let result;
  try {
    writeFileSync(flowBiblePath, mutate(original, edits), 'utf8');
    result = runGuard();
  } finally {
    writeFileSync(flowBiblePath, original, 'utf8'); // always restore
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

console.log('GLOBAL-RESPONSE NEGATIVE TESTS (Codex B1 prose-hidden spoken global)\n');

// Baseline: clean tree must PASS.
{
  const { code } = runGuard();
  if (code === 0) console.log('  PASS  baseline: clean tree passes the guard');
  else {
    failures += 1;
    console.log(`  FAIL  baseline: clean tree should pass but guard exited ${code}`);
  }
}

// Test A (B1 probe): the EXACT Codex probe — a prose-only spoken global with no voice
// and no registry entry. Injected as the first GLOBAL_RULES entry.
withMutation(
  'B1 probe (prose-hidden spoken global, no voice, no registry) fails the guard',
  [
    [
      "  rules: [\n    {\n      id: 'glob-crisis',",
      "  rules: [\n    {\n      id: 'glob-unregistered-spoken-probe',\n" +
        "      rule: 'On an unrecognized global input, say \"Let us get back to your onboarding\" and then re-ask the current question.',\n" +
        "      severity: 'must',\n" +
        "      enforcedBy: ['eval:out-of-scope-decline'],\n" +
        "    },\n    {\n      id: 'glob-crisis',",
    ],
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — a prose-hidden spoken global with no owner was accepted');
    if (!/glob-unregistered-spoken-probe/.test(out))
      throw new Error('the guard failed but did not name the probe rule');
    if (!/prescribes a spoken coach line/.test(out))
      throw new Error('the B1-R prose lint (lane g) did not fire on the probe');
  },
);

// Test B (spoken response with no owner): strip the voice from the tool-failure-voice
// GLOBAL_RESPONSES row. Lane f requires a legal owner for every spoken row.
withMutation(
  'a modality:spoken GLOBAL_RESPONSES row with no voice owner fails the guard',
  [
    [
      "    id: 'tool-failure-voice',\n    modality: 'spoken',\n    line: \"That didn't go through, let me try again.\",\n    voice: 'clip-family:onboard_tool_failure_retry (pending recording)',",
      "    id: 'tool-failure-voice',\n    modality: 'spoken',\n    line: \"That didn't go through, let me try again.\",",
    ],
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — a spoken response with no owner was accepted');
    if (!/tool-failure-voice/.test(out))
      throw new Error('the guard failed but did not name the unowned spoken response');
    if (!/modality 'spoken' but voice .* is not one of the four legal shapes/.test(out))
      throw new Error('the B1-R lane-f ownership requirement did not fire');
  },
);

// Test C (spoken response outside the registry): add a spoken GLOBAL_RESPONSES row with
// a legal voice but no GLOBAL_VOICE_OWNERSHIP entry. Lane f set-equality rejects it.
withMutation(
  'a spoken GLOBAL_RESPONSES row outside the ownership registry fails the guard',
  [
    [
      'export const GLOBAL_RESPONSES: readonly GlobalResponse[] = [',
      "export const GLOBAL_RESPONSES: readonly GlobalResponse[] = [\n" +
        "  {\n" +
        "    id: 'glob-phantom-spoken',\n" +
        "    modality: 'spoken',\n" +
        "    line: 'Some prescribed global line.',\n" +
        "    voice: 'clip-family:onboard_phantom (pending recording)',\n" +
        "  },",
    ],
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — a spoken response outside the registry was accepted');
    if (!/glob-phantom-spoken/.test(out))
      throw new Error('the guard failed but did not name the unregistered spoken response');
    if (!/NO matching GLOBAL_VOICE_OWNERSHIP entry/.test(out))
      throw new Error('the B1-R lane-f set-equality guard did not fire');
  },
);

console.log('');
if (failures) {
  console.log(`GLOBAL-RESPONSE NEGATIVE TESTS: ${failures} failure(s).`);
  process.exit(1);
}
console.log(
  'GLOBAL-RESPONSE NEGATIVE TESTS: all passed (guard bites on the B1 prose-hidden spoken global, an unowned spoken response, and a spoken response outside the registry).',
);

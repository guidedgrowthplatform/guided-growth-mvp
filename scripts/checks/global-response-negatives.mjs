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
//   Test A (B1 probe): the EXACT prior Codex probe — a GLOBAL_RULES entry
//     'glob-unregistered-spoken-probe' whose `rule` prose carries a double-quoted line.
//     STILL fails: the hard quote lint (lane g) rejects any quote in prose.
//   Bypass classes (the reason the fix is structural, not a widened regex): the same
//     spoken line via a COLON (say: "..."), SINGLE QUOTES (say '...'), or PARENTHESES
//     (say ("...")) all still contain a quote, so lane g rejects them; and an UNQUOTED
//     prescribed response (no quote at all) is caught structurally by lane f, because a
//     rule that declares it emits a response must link a responseId that resolves to a
//     real, owned GLOBAL_RESPONSES row.
//   Test B (spoken response with no owner): a GLOBAL_RESPONSES modality:'spoken' row
//     stripped of its `voice` owner. Lane e rejects it (every spoken response must be
//     owned).
//   Test C (spoken response outside the registry): a NEW GLOBAL_RESPONSES spoken row
//     with a legal voice but no matching GLOBAL_VOICE_OWNERSHIP entry. Lane e set-
//     equality rejects it (no spoken response may live outside the ownership registry).
//   Test D (duplicate GLOBAL_RESPONSES id): two rows sharing an id. The uniqueness check
//     rejects it (a Set/Map-overwrite would silently keep the last, an ambiguous source).
//   Bypass classes 5-7 (QA hardening, 2026-07-11: quote-glyph completeness + length cap):
//     a BACKTICK pair (say `...`), GUILLEMETS (say «...»), and a single-quoted line OVER
//     300 chars all used to slip the old lint (it covered only straight/curly double and
//     single quotes, and single-quote pairs were capped at 300 chars). The hardened lint
//     rejects any quote/backtick/guillemet glyph, and the single-quote-pair length cap is
//     removed.
//   Test E (duplicate GLOBAL_RULES id, QA hardening 2026-07-11): two GLOBAL_RULES rules
//     sharing an id. Mirrors Test D but for rule ids (validateGlobalRuleEffects), which
//     had no uniqueness check before this hardening pass.
//   Bypass class 8 (interior contraction, QA hardening 2026-07-11): the word-boundary
//     anchoring added to fix bypass classes 5-7's sibling apostrophe false positive
//     reopened a hole — a single-quoted response line with a contraction INSIDE it (say
//     'Let's get back to your onboarding') failed to pair because the interior class could
//     not cross the mid-quote apostrophe. Interior apostrophes are now consumable only when
//     mid-word, so the pair still closes across a contraction.
//   Property-approach lock (QA hardening, 2026-07-11): the quote-glyph detection is now
//     PROPERTY-BASED (Unicode Quotation_Mark + a small extra set of backtick/primes/modifier
//     apostrophes, MINUS the two apostrophe-capable code points U+0027 and U+2019), not an
//     enumerated glyph list — so it generalizes to quote glyphs that were never explicitly
//     listed and ends the per-cycle whack-a-mole. These four committed cases lock that: a
//     curly single-quote PAIR (’…’, both U+2019, caught by the deferred pair check), an
//     UNPAIRED left single quote (‘, U+2018), a CJK corner-bracket pair (「…」), and a
//     BEYOND-ENUMERATION pair the prior enumerated class never named (〝…〞, U+301D/U+301E) —
//     all rejected by the property test with no glyph list left to extend.
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

// Helper: build a GLOBAL_RULES probe injected as the FIRST entry, with a typed effect
// so the ONLY failing lane is the one under test (isolates the diagnostic).
function injectRule({ id, rule, effect }) {
  return [
    "  rules: [\n    {\n      id: 'glob-crisis',",
    `  rules: [\n    {\n      id: '${id}',\n` +
      `      rule: ${rule},\n` +
      "      severity: 'must',\n" +
      "      enforcedBy: ['eval:out-of-scope-decline'],\n" +
      `      effect: ${effect},\n` +
      "    },\n    {\n      id: 'glob-crisis',",
  ];
}

// Test A (B1 probe): the EXACT prior Codex probe — a double-quoted spoken line in rule
// prose. Still fails: the hard quote lint (lane g) rejects any quote in prose.
withMutation(
  'B1 probe (glob-unregistered-spoken-probe: double-quoted line in prose) fails the guard',
  [
    injectRule({
      id: 'glob-unregistered-spoken-probe',
      rule: '\'On an unrecognized global input, say "Let us get back to your onboarding" and then re-ask the current question.\'',
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — a double-quoted spoken line in rule prose was accepted');
    if (!/glob-unregistered-spoken-probe/.test(out))
      throw new Error('the guard failed but did not name the probe rule');
    if (!/contains a quoted string/.test(out))
      throw new Error('the B1-R2 quote lint (lane g) did not fire on the probe');
  },
);

// Bypass class 1 — COLON (`say: "..."`). The old regex allowed only word chars between
// the speech verb and the quote, so a colon slipped it. The hard quote lint bites.
withMutation(
  'bypass: colon (say: "...") fails the guard',
  [
    injectRule({
      id: 'glob-colon-spoken-probe',
      rule: '\'On an unrecognized global input, say: "Let us get back to your onboarding" and then re-ask.\'',
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — the colon bypass (say: "...") was accepted');
    if (!/glob-colon-spoken-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the colon bypass');
  },
);

// Bypass class 2 — SINGLE QUOTES. The old regex matched only double/curly-double quotes.
// Single-quoted copy slipped it. Written with double-quote TS delimiters to hold the
// single-quoted phrase in the parsed prose.
withMutation(
  "bypass: single-quote (say '...') fails the guard",
  [
    injectRule({
      id: 'glob-singlequote-spoken-probe',
      rule: '"On an unrecognized global input, say \'Let us get back to your onboarding\' and then re-ask."',
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error("guard exited 0 — the single-quote bypass (say '...') was accepted");
    if (!/glob-singlequote-spoken-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the single-quote bypass');
  },
);

// Bypass class 3 — PARENTHESES around the quote. The old regex only allowed word chars
// before the quote, so a parenthesis slipped it. The hard quote lint bites (a quote is
// a quote regardless of surrounding punctuation).
withMutation(
  'bypass: parenthesis (say ("...")) fails the guard',
  [
    injectRule({
      id: 'glob-paren-spoken-probe',
      rule: '\'On an unrecognized global input, say ("Let us get back to your onboarding") and re-ask.\'',
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — the parenthesis bypass was accepted');
    if (!/glob-paren-spoken-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the parenthesis bypass');
  },
);

// Bypass class 4 — UNQUOTED prescribed response (no quote at all, so the quote lint can
// never see it). Structurally caught: the rule declares it emits a response
// (effect.kind 'response') but its responseId resolves to NO GLOBAL_RESPONSES row.
withMutation(
  'bypass: unquoted prescribed response (dangling responseId) fails the guard',
  [
    injectRule({
      id: 'glob-unquoted-response-probe',
      rule: "'On an unrecognized global input, deliver the standard steer-back response and then re-ask the current question.'",
      effect: "{ kind: 'response', responseId: 'glob-unquoted-response-probe' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — an unquoted prescribed response with a dangling responseId was accepted');
    if (!/glob-unquoted-response-probe/.test(out))
      throw new Error('the guard failed but did not name the unquoted-response probe');
    if (!/does not resolve to any GLOBAL_RESPONSES row/.test(out))
      throw new Error('the B1-R2 effect-link resolution (lane f) did not fire on the unquoted probe');
  },
);

// Bypass class 5 — BACKTICK PAIR (say `...`). The hard quote lint used to only cover
// straight/curly double and single quotes; a backtick pair slipped it entirely (QA
// hardening, 2026-07-11). Backtick never doubles as an apostrophe, so it is rejected on
// ANY occurrence.
withMutation(
  'bypass: backtick pair (say `...`) fails the guard',
  [
    injectRule({
      id: 'glob-backtick-probe',
      rule: "'On an unrecognized global input, say `Let us get back to your onboarding` and then re-ask.'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — a backtick pair in rule prose was accepted');
    if (!/glob-backtick-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the backtick-pair bypass');
  },
);

// Bypass class 6 — GUILLEMETS («...»). Also slipped the old lint entirely. Guillemets
// never double as an apostrophe either, so they are rejected on ANY occurrence.
withMutation(
  'bypass: guillemets (say «...») fails the guard',
  [
    injectRule({
      id: 'glob-guillemet-probe',
      rule: "'On an unrecognized global input, say «Let us get back to your onboarding» and then re-ask.'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0) throw new Error('guard exited 0 — a guillemet pair in rule prose was accepted');
    if (!/glob-guillemet-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the guillemet bypass');
  },
);

// Bypass class 7 — LONG single-quoted line (>300 chars). The single-quote-pair regex
// used to cap the interior at 300 chars, so a single-quoted line longer than that slipped
// the lint entirely (QA hardening, 2026-07-11). The cap is now removed; any length must
// be caught.
withMutation(
  'bypass: single-quoted line over 300 chars fails the guard (length cap removed)',
  [
    injectRule({
      id: 'glob-long-singlequote-probe',
      rule: `"On an unrecognized global input, say '${'x'.repeat(320)}' and then re-ask."`,
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error(
        'guard exited 0 — a single-quoted line over 300 chars was accepted (length cap not removed)',
      );
    if (!/glob-long-singlequote-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the long single-quoted line');
  },
);

// Bypass class 8 — INTERIOR CONTRACTION inside a single-quoted response line (QA
// hardening, 2026-07-11: word-boundary-anchoring fix reopened this). The word-boundary
// anchors added to stop the mid-word-apostrophe false positive also broke the single-quote
// PAIR match whenever the quoted interior itself contained an apostrophe/contraction (the
// interior character class could not cross it and no alternate anchored opener existed), so
// a single-quoted spoken line with a contraction inside — e.g. say 'Let's get back to your
// onboarding' — silently passed. The regex now consumes an interior apostrophe only when it
// is mid-word (lookbehind/lookahead both \w), so the pair still closes across a contraction.
withMutation(
  "bypass: single-quoted line with an interior contraction (say 'Let's ...') fails the guard",
  [
    injectRule({
      id: 'glob-interior-contraction-probe',
      rule: '"On an unrecognized global input, say \'Let\'s get back to your onboarding\' and then re-ask."',
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error(
        "guard exited 0 — a single-quoted line with an interior contraction (say 'Let's ...') was accepted",
      );
    if (!/glob-interior-contraction-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the interior-contraction bypass');
  },
);

// Property-approach lock 1 — CURLY SINGLE-QUOTE PAIR (’…’, both delimiters U+2019). The
// property fix defers U+2019 to the word-boundary-anchored pair check, which still catches a
// genuine quoted pair (QA hardening, 2026-07-11: proves the deferred apostrophe path bites).
withMutation(
  'property-lock: curly single-quote pair (’…’) fails the guard',
  [
    injectRule({
      id: 'glob-curly-pair-probe',
      rule: "'On an unrecognized global input, say ’Let us get back to your onboarding’ and then re-ask.'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — a curly single-quote pair (’…’) in rule prose was accepted');
    if (!/glob-curly-pair-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the curly single-quote pair');
  },
);

// Property-approach lock 2 — UNPAIRED left single quote (‘, U+2018). U+2018 is a real
// quotation mark that never doubles as an apostrophe, so the property test rejects it on ANY
// occurrence — no pairing required (QA hardening, 2026-07-11).
withMutation(
  'property-lock: unpaired left single quote (‘) fails the guard',
  [
    injectRule({
      id: 'glob-unpaired-lsq-probe',
      rule: "'On an unrecognized global input, treat a stray ‘ mark as a quote and re-ask the current question.'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — an unpaired left single quote (‘) in rule prose was accepted');
    if (!/glob-unpaired-lsq-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the unpaired left single quote');
  },
);

// Property-approach lock 3 — CJK corner-bracket pair (「…」). Carries the Quotation_Mark
// property, so it is caught even though it was never on any enumerated list (QA hardening,
// 2026-07-11).
withMutation(
  'property-lock: CJK corner-bracket pair (「…」) fails the guard',
  [
    injectRule({
      id: 'glob-cjk-corner-probe',
      rule: "'On an unrecognized global input, say 「Let us get back to your onboarding」 and then re-ask.'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — a CJK corner-bracket pair (「…」) in rule prose was accepted');
    if (!/glob-cjk-corner-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the CJK corner-bracket pair');
  },
);

// Property-approach lock 4 — BEYOND-ENUMERATION quote marks (〝…〞, U+301D/U+301E). These were
// never on the prior enumerated glyph class; the property test catches them anyway. This is
// the proof the whack-a-mole is over (QA hardening, 2026-07-11).
withMutation(
  'property-lock: beyond-enumeration quote marks (〝…〞) fail the guard',
  [
    injectRule({
      id: 'glob-beyond-enum-probe',
      rule: "'On an unrecognized global input, say 〝Let us get back to your onboarding〞 and then re-ask.'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — beyond-enumeration quote marks (〝…〞) in rule prose were accepted');
    if (!/glob-beyond-enum-probe/.test(out) || !/contains a quoted string/.test(out))
      throw new Error('the quote lint did not fire on the beyond-enumeration quote marks');
  },
);

// Duplicate GLOBAL_RULES id: two rules sharing the same id would make precedence and
// spoken-response ownership ambiguous. Reuse the existing 'glob-crisis' id for the
// injected probe so the ONLY failure is the new duplicate-id diagnostic (QA hardening,
// 2026-07-11, mirrors the pre-existing GLOBAL_RESPONSES duplicate-id check).
withMutation(
  'a duplicate GLOBAL_RULES id (two rules share glob-crisis) fails the guard',
  [
    injectRule({
      id: 'glob-crisis',
      rule: "'A second rule reusing the glob-crisis id (ambiguous precedence and ownership).'",
      effect: "{ kind: 'constraint' }",
    }),
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — two GLOBAL_RULES rules sharing the same id were accepted');
    if (!/GLOBAL_RULES "glob-crisis": duplicate id/.test(out))
      throw new Error('the GLOBAL_RULES rule-id uniqueness check did not fire on the duplicate id');
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
      throw new Error('the B1-R lane-e set-equality guard did not fire');
  },
);

// Test D (GLOBAL_RESPONSES duplicate id): two rows sharing an id. A Set/Map-overwrite
// would silently keep the last row (ambiguous copy source); the uniqueness check rejects
// it. Duplicate the existing glob-out-of-scope spoken row (same id, same voice) so set-
// equality still holds and the ONLY failure is the duplicate-id diagnostic.
withMutation(
  'a duplicate GLOBAL_RESPONSES id (two rows, same id) fails the guard',
  [
    [
      'export const GLOBAL_RESPONSES: readonly GlobalResponse[] = [',
      'export const GLOBAL_RESPONSES: readonly GlobalResponse[] = [\n' +
        '  {\n' +
        "    id: 'glob-out-of-scope',\n" +
        "    modality: 'spoken',\n" +
        "    line: 'Duplicate row with the same id (ambiguous copy source).',\n" +
        "    voice: 'clip-family:onboard_offtopic_steerback (pending recording)',\n" +
        '  },',
    ],
  ],
  ({ code, out }) => {
    if (code === 0)
      throw new Error('guard exited 0 — two GLOBAL_RESPONSES rows with the same id were accepted');
    if (!/GLOBAL_RESPONSES "glob-out-of-scope": duplicate id/.test(out))
      throw new Error('the GLOBAL_RESPONSES uniqueness check did not fire on the duplicate id');
  },
);

console.log('');
if (failures) {
  console.log(`GLOBAL-RESPONSE NEGATIVE TESTS: ${failures} failure(s).`);
  process.exit(1);
}
console.log(
  'GLOBAL-RESPONSE NEGATIVE TESTS: all passed (guard bites on the B1 double-quote probe, ' +
    'the colon / single-quote / parenthesis / unquoted-response / backtick / guillemet / ' +
    'long-single-quote / interior-contraction bypass classes, the property-approach lock ' +
    'cases (curly single-quote pair, unpaired left single quote, CJK corner-bracket pair, ' +
    'beyond-enumeration quote marks), an unowned spoken response, a spoken response outside ' +
    'the registry, a duplicate GLOBAL_RESPONSES id, and a duplicate GLOBAL_RULES id).',
);

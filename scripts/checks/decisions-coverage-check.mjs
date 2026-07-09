// Registry id: decisions-coverage-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "every beat maps the 7 decisions
// (binds or explicit none)".
//
// Grounded in bible.applicableDecisions on category-women / goals-sleep: every
// row states a decision, whether it BINDS on this beat (true, with a `how`
// naming the enforced mechanism) or explicitly does NOT (false, with a `how`
// explaining why it's not this beat). "Explicit none" is the operative phrase:
// a beat may not simply omit a decision it doesn't touch, it must say so.
// This check enforces the shape that makes that claim machine-verifiable:
//   1. bible.applicableDecisions.rows must be non-empty.
//   2. Every row must name a decision, a boolean `binds`, and a non-empty `how`
//      — a row with binds but no how (or vice versa) is not "binds or explicit
//      none", it's an unstated claim.
//   3. A row with binds === true must cite at least one real enforcer id
//      (either the section's own top-level enforcedBy or a rule id from this
//      beat's rulesContext/rulesCode) somewhere in its `how` text, so a
//      binding claim always names the mechanism that enforces it.

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

for (const { beatId, value: beat, line } of bibleBeats) {
  const decisions = beat.bible.applicableDecisions;
  if (!decisions) continue;

  if (!Array.isArray(decisions.rows) || decisions.rows.length === 0) {
    problems.push(`${beatId} (line ${line}): bible.applicableDecisions.rows is empty`);
    continue;
  }

  // Every rule id authored anywhere on this beat, for the "names the mechanism" check.
  const ruleIds = new Set([
    ...(beat.bible.rulesContext ?? []).map((r) => r.id),
    ...(beat.bible.rulesCode ?? []).map((r) => r.id),
  ]);

  for (const row of decisions.rows) {
    if (typeof row.decision !== 'string' || !row.decision.trim()) {
      problems.push(`${beatId} (line ${line}): applicableDecisions row is missing a decision label`);
      continue;
    }
    if (typeof row.binds !== 'boolean') {
      problems.push(
        `${beatId} (line ${line}): applicableDecisions row "${row.decision}" has no boolean binds ` +
          `(must state binds or explicit none)`,
      );
      continue;
    }
    if (typeof row.how !== 'string' || !row.how.trim()) {
      problems.push(
        `${beatId} (line ${line}): applicableDecisions row "${row.decision}" (binds=${row.binds}) ` +
          `has no "how" explanation`,
      );
      continue;
    }
    if (row.binds === true) {
      const namesAMechanism = [...ruleIds].some((id) => row.how.includes(id));
      if (!namesAMechanism) {
        problems.push(
          `${beatId} (line ${line}): applicableDecisions row "${row.decision}" binds=true but its ` +
            `"how" names no rule id from this beat's own rulesContext/rulesCode`,
        );
      }
    }
  }
}

report(
  problems,
  `decisions-coverage-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `every applicableDecisions row states binds-or-explicit-none with a stated mechanism.`,
);

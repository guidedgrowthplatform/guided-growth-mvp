// Guard family: DECISIONS COVERAGE (render-bible section applicable-decisions).
// Each beat states which of the 7 locked engine decisions
// (onboarding-behavior-decisions-2026-07-09.md) bind on it — explicitly
// "binds: false", never silently absent — so the decisions doc and the
// code rules cannot drift apart. The decision-bearing beats must claim
// their decisions; once the fill is complete, all 7 must be claimed
// somewhere. Shape per !531: [{ decision, binds, how }].

import { loadBeatsSource, report } from './render-guards-lib.mjs';

// Decision numbers each beat must claim binds:true (per the bible spec
// mapping; goals-* capture the count for 4/5 but the gate binds on habits).
const REQUIRED_BINDINGS = {
  'profile-asks': [1, 2, 3],
  'category-women': [3],
  reflection: [6, 7],
  habits: [4, 5],
};
const ALL_DECISIONS = [1, 2, 3, 4, 5, 6, 7];

const { beats } = await loadBeatsSource(process.argv[2]);

const problems = [];
const gaps = [];
const notes = [];

// "4/5. Habit cap..." binds 4 and 5; numbers live before the first period.
const boundNumbers = (decision) => {
  const head = String(decision).split('.')[0];
  return [...head.matchAll(/\d+/g)].map((m) => Number(m[0]));
};

const claimed = new Set();
let filled = 0;
for (const beat of beats) {
  const decisions = beat.bible?.applicableDecisions;
  if (!decisions) {
    gaps.push(`${beat.id}: bible.applicableDecisions not filled`);
    continue;
  }
  filled += 1;
  if (!Array.isArray(decisions) || decisions.length === 0) {
    problems.push(`${beat.id}: applicableDecisions must be a non-empty list (explicit "none")`);
    continue;
  }
  const binds = new Set();
  for (const entry of decisions) {
    if (typeof entry?.decision !== 'string' || !entry.decision.trim()) {
      problems.push(`${beat.id}: applicableDecisions entry has no decision text`);
      continue;
    }
    if (typeof entry.binds !== 'boolean') {
      problems.push(`${beat.id}: "${entry.decision.slice(0, 40)}" needs an explicit binds boolean`);
    }
    if (typeof entry.how !== 'string' || !entry.how.trim()) {
      problems.push(`${beat.id}: "${entry.decision.slice(0, 40)}" needs a how`);
    }
    if (entry.binds === true) {
      const nums = boundNumbers(entry.decision);
      if (!nums.length) {
        problems.push(
          `${beat.id}: binding decision "${entry.decision.slice(0, 60)}" names no decision number`,
        );
      }
      nums.forEach((n) => {
        binds.add(n);
        claimed.add(n);
      });
    }
  }
  const required = REQUIRED_BINDINGS[beat.id];
  if (required) {
    const missing = required.filter((n) => !binds.has(n));
    if (missing.length) {
      problems.push(
        `${beat.id}: must claim decision(s) ${missing.join(', ')} binds:true (decision-bearing beat)`,
      );
    }
  }
}

const unclaimed = ALL_DECISIONS.filter((n) => !claimed.has(n));
if (filled === beats.length && unclaimed.length) {
  problems.push(`fill complete but decision(s) ${unclaimed.join(', ')} bound by no beat`);
} else if (filled > 0 && unclaimed.length) {
  notes.push(`decision(s) ${unclaimed.join(', ')} not yet bound by any filled beat (fill partial)`);
}

report('DECISIONS-COVERAGE check', {
  problems,
  gaps,
  notes,
  passMsg: `${filled}/${beats.length} beats declare coverage, decisions claimed: ${[...claimed].sort().join(', ') || 'none yet'}.`,
});

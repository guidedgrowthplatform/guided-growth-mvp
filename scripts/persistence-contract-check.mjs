// Guard family: PERSISTENCE CONTRACT (render-bible section 9).
// Every data-writing beat must state what it writes, what it must never
// re-ask (the carry-forward contract), and its resume key — this is where
// reflection persistence (decision 6) and verbatim custom prompts
// (decision 7) become machine contracts. A beat that calls a write tool
// with no persistence contract is unresumable by spec. Shape per !531.

import { loadBeatsSource, report } from './render-guards-lib.mjs';

// Tools that don't write user data; anything else marks the beat a writer.
const NON_WRITING_TOOLS = new Set(['advance_step', 'ask_clarification']);
const REQUIRED_ROWS = ['writes', 'never re-ask', 'resume key'];

const { beats } = await loadBeatsSource(process.argv[2]);

const problems = [];
const gaps = [];

const isWriter = (beat) =>
  (beat.allowedTools ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .some((t) => !NON_WRITING_TOOLS.has(t));

let verified = 0;
let writers = 0;
for (const beat of beats) {
  const persistence = beat.bible?.persistence;
  if (!persistence) {
    if (isWriter(beat)) {
      writers += 1;
      gaps.push(`${beat.id}: writes via [${beat.allowedTools}] but bible.persistence not filled`);
    }
    continue;
  }
  verified += 1;
  if (isWriter(beat)) writers += 1;
  const rows = new Map((persistence.rows ?? []).map((r) => [r?.label, r?.value]));
  for (const label of REQUIRED_ROWS) {
    const value = rows.get(label);
    if (typeof value !== 'string' || !value.trim()) {
      problems.push(`${beat.id}: persistence row "${label}" missing or empty`);
    }
  }
  if (persistence.enforcedBy && persistence.enforcedBy !== 'persistence-contract-check') {
    problems.push(
      `${beat.id}: persistence names enforcer "${persistence.enforcedBy}" (must be persistence-contract-check)`,
    );
  }
}

report('PERSISTENCE-CONTRACT check', {
  problems,
  gaps,
  passMsg: `${writers} data-writing beat(s), ${verified} persistence contract(s) verified.`,
});

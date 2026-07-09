// Registry id: reveal-timing-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "reveals gate on clip end, never
// timers".
//
// Grounded in bible.scriptMeta on the two owner beats (category-women,
// goals-sleep): every row after the first spoken line reads "GATED on seq N
// clip end" / "GATED on seq N reveal", never a fixed duration. This check
// enforces that convention mechanically:
//   1. The first script line (lowest seq) may legitimately say "no gate" (it
//      has nothing before it to gate on).
//   2. Every OTHER row's `reveal` text must contain the word "gate" — a reveal
//      with no gating language at all is exactly the un-enforceable prose the
//      registry rule exists to close off.
//   3. When a row cites "seq N" as the thing it gates on, N must not refer to a
//      LATER seq (a row can't gate on something that hasn't played yet). A row
//      may cite its own seq (a single row can bundle "this line's bubble, then
//      this line's own clip-end gates a second visual in the same row") or an
//      earlier one (a later row gating on a prior row's clip end).
//   4. Neither `reveal` nor `timing` may describe a fixed wall-clock duration
//      (e.g. "wait 3 seconds", "after 2000ms", "timeout") — that is precisely
//      the timer-based reveal the rule bans. Prose reporting *narration* timing
//      like "karaoke per-word" is fine; a bare digit+time-unit is not.

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

const FIXED_TIMER_RE = /\b\d+\s?(ms|milliseconds?|secs?|seconds?|minutes?|mins?)\b/i;
const GATE_RE = /\bgate/i;
const NO_GATE_RE = /\bno gate\b/i;
const SEQ_REF_RE = /\bseq[\s-]?(\d+)\b/i;

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

for (const { beatId, value: beat, line } of bibleBeats) {
  const scriptMeta = beat.bible.scriptMeta;
  if (!scriptMeta || !Array.isArray(scriptMeta.rows) || scriptMeta.rows.length === 0) continue;

  const rows = [...scriptMeta.rows].sort((a, b) => a.seq - b.seq);
  const minSeq = rows[0].seq;

  for (const row of rows) {
    const reveal = row.reveal ?? '';
    const timing = row.timing ?? '';
    const combined = `${reveal} ${timing}`;

    // 2. Every row past the first must be clip-end gated, not bare prose.
    if (row.seq !== minSeq && !GATE_RE.test(reveal)) {
      problems.push(
        `${beatId} (line ${line}) scriptMeta seq ${row.seq}: reveal has no gating language ` +
          `("${reveal}") — every reveal after the opener must gate on a prior clip end`,
      );
    }
    if (row.seq === minSeq && !GATE_RE.test(reveal) && !NO_GATE_RE.test(reveal)) {
      problems.push(
        `${beatId} (line ${line}) scriptMeta seq ${row.seq}: opener reveal is neither gated nor ` +
          `explicitly "no gate" ("${reveal}")`,
      );
    }

    // 3. A cited seq must not be a LATER seq than this row's own (self- or
    // earlier-references are legitimate; forward references are not).
    const seqRef = reveal.match(SEQ_REF_RE);
    if (seqRef) {
      const referenced = Number(seqRef[1]);
      if (referenced > row.seq) {
        problems.push(
          `${beatId} (line ${line}) scriptMeta seq ${row.seq}: gates on seq ${referenced}, ` +
            `which hasn't played yet (reveal: "${reveal}")`,
        );
      }
    }

    // 4. No fixed wall-clock timer language anywhere in reveal/timing.
    if (FIXED_TIMER_RE.test(combined)) {
      problems.push(
        `${beatId} (line ${line}) scriptMeta seq ${row.seq}: reveal/timing names a fixed duration ` +
          `("${combined.trim()}") — reveals must gate on clip end, never a timer`,
      );
    }
  }
}

report(
  problems,
  `reveal-timing-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `no un-gated or timer-based reveals found.`,
);

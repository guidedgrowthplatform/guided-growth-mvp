// Registry id: audio-ownership-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "only {name} lines may be live;
// all else resolves to clips".
//
// Grounded in bible.voice.perLine on category-women / goals-sleep: every
// spoken line's `resolvesTo` names either a recorded clip id or a silent
// reveal, and `liveAllowed` is the machine-checkable flag. This enforces the
// exact contract:
//   1. A line whose resolvesTo contains the live `{name}` slot must have
//      liveAllowed === 'YES' (case-insensitive) — only these lines may go live.
//   2. A line whose resolvesTo does NOT contain `{name}` and is not a silent /
//      no-audio reveal must have liveAllowed === 'NO' exactly — anything else
//      (missing, 'YES', 'maybe', ...) would let a non-{name} line go live,
//      which the rule bans outright.
//   3. perLine must cover every spoken script line (voice !== null on the
//      matching seq) and must not reference a seq that doesn't exist on the
//      beat's own script — a stale or missing per-line entry is exactly the
//      kind of drift this registry entry exists to catch.

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

const LIVE_SLOT_RE = /\{name\}/;
const SILENT_RE = /no audio|silent reveal|n\/a/i;

for (const { beatId, value: beat, line } of bibleBeats) {
  const voice = beat.bible.voice;
  if (!voice || !Array.isArray(voice.perLine) || voice.perLine.length === 0) continue;

  const script = Array.isArray(beat.script) ? beat.script : [];
  const scriptSeqs = new Set(script.map((s) => s.seq));
  const spokenSeqs = new Set(script.filter((s) => s.voice !== null).map((s) => s.seq));
  const perLineSeqs = new Set();

  for (const perLine of voice.perLine) {
    perLineSeqs.add(perLine.seq);

    if (!scriptSeqs.has(perLine.seq)) {
      problems.push(
        `${beatId} (line ${line}): voice.perLine references seq ${perLine.seq}, ` +
          `which does not exist in this beat's script[]`,
      );
      continue;
    }

    const resolvesTo = perLine.resolvesTo ?? '';
    const liveAllowed = perLine.liveAllowed ?? '';
    const isLiveSlot = LIVE_SLOT_RE.test(resolvesTo);
    const isSilent = SILENT_RE.test(resolvesTo);

    if (isLiveSlot) {
      if (!/^yes$/i.test(liveAllowed)) {
        problems.push(
          `${beatId} (line ${line}) seq ${perLine.seq}: resolvesTo carries a live {name} slot ` +
            `but liveAllowed is "${liveAllowed}" (must be YES)`,
        );
      }
    } else if (!isSilent) {
      if (!/^no$/i.test(liveAllowed)) {
        problems.push(
          `${beatId} (line ${line}) seq ${perLine.seq}: resolvesTo ("${resolvesTo}") has no {name} ` +
            `slot, so it must resolve to a fixed clip — liveAllowed is "${liveAllowed}", must be NO`,
        );
      }
    }
  }

  // 3. Coverage: every spoken script line needs a perLine entry.
  for (const seq of spokenSeqs) {
    if (!perLineSeqs.has(seq)) {
      problems.push(
        `${beatId} (line ${line}): script seq ${seq} has voice audio but no matching voice.perLine entry`,
      );
    }
  }
}

report(
  problems,
  `audio-ownership-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `every non-{name} line resolves to a fixed clip and perLine covers every spoken seq.`,
);

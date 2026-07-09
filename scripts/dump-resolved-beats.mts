// Helper for bible-registry-check.mjs: emits the RESOLVED bible for every
// onboarding beat as JSON on stdout. The guard shells out to this (via tsx) so
// its coverage + variant-inheritance leak checks run against the resolver's
// ACTUAL output, not a re-implementation of it (no circularity: if the resolver
// stops deriving per-variant content, the leak scan here sees the head tokens and
// the guard fails).

import {
  BEATS_SOURCE,
  BEAT_BY_ID,
  resolveBeatStructure,
  rulePrefix,
} from '../src/components/flow-designer/beatsSource.ts';

const out = BEATS_SOURCE.map((beat) => {
  const resolved = resolveBeatStructure(beat.id);
  const head = beat.variantOf ? BEAT_BY_ID[beat.variantOf] : undefined;
  const headTokens = head
    ? {
        category: head.props?.category ?? null,
        clips: head.script.map((line) => line.clip).filter((c): c is string => Boolean(c)),
        rulePrefix: rulePrefix(head.id),
        id: head.id,
        screenId: head.screenId ?? null,
      }
    : null;
  return {
    id: beat.id,
    type: beat.type,
    variantOf: beat.variantOf ?? null,
    hasOwnBible: Boolean(beat.bible),
    // section keys the beat AUTHORS itself (manifest excluded)
    ownBibleKeys: beat.bible ? Object.keys(beat.bible).filter((k) => k !== 'sectionManifest') : [],
    resolvedManifest: resolved.bible?.sectionManifest ?? null,
    resolvedBible: resolved.bible ?? null,
    derivedSections: resolved.derivedSections ?? [],
    // for the guard's leak scan: the head tokens that must NOT survive onto a
    // variant's derived sections (category label, clip ids, rule-id prefix,
    // beatId, screenId).
    headTokens,
  };
});

process.stdout.write(JSON.stringify(out));

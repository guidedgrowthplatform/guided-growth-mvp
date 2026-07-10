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
  goalsSemanticTokens,
  goalsCategoryData,
  habitsSemanticTokens,
  HABITS_HEAD_CLIP,
  categorySemanticTokens,
  categoryData,
  type BeatEntry,
} from '../src/components/flow-designer/beatsSource.ts';

// INDEPENDENT canonical semantic-token generator (Codex G1, 2026-07-10). It does
// NOT call the exported *SemanticTokens; it recomputes the head-family tokens
// straight from the SAME typed family data the section builders consume, so a
// drifted exported set (exported !== canonical) fails the family guard. Returns null
// for a head family that has no registered typed contract.
//
// goals family: recomputed from goalsCategoryData (buildGoals* consume it).
function canonicalGoalsSemanticTokens(category: string | null): string[] | null {
  if (!category) return null;
  const data = goalsCategoryData[category];
  if (!data) return null; // no typed family contract registered for this head
  const goalExample = data.downstreamExample.split('->')[0]?.trim() ?? '';
  return [
    data.noun,
    `onboard_goals_${data.slug}`,
    `goals-${data.slug}`,
    goalExample,
  ].filter((t) => t.length > 0);
}

// Per-family dispatch. The habits head is the GENERIC picker (no goal), so its one
// head-specific semantic token is its generic opener clip (HABITS_HEAD_CLIP), which
// no per-goal variant carries; buildHabits* rebuild the per-goal sensitive sections
// so the real per-goal leak protection is the substitution-path guard, not this set.
function headSemanticTokens(head: BeatEntry): string[] {
  if (head.type === 'goals-list' && head.props?.category)
    return [...goalsSemanticTokens(head.props.category)];
  if (head.type === 'habit-picker') return [...habitsSemanticTokens()];
  // category-grid: the head is the GENERIC picker (props: null), like habits; its
  // one head-specific semantic token is its generic opener clip. Its sole variant
  // (category-women) authors its own full bible and derives nothing, so this token
  // is never leak-scanned against a variant; it exists to satisfy the family
  // contract. Recomputed independently below from categoryData.
  if (head.type === 'category-grid') return [...categorySemanticTokens()];
  return [];
}
function headCanonicalSemanticTokens(head: BeatEntry): string[] | null {
  if (head.type === 'goals-list')
    return canonicalGoalsSemanticTokens(head.props?.category ?? null);
  if (head.type === 'habit-picker') return [HABITS_HEAD_CLIP];
  // category-grid canonical: recomputed straight from categoryData (NOT via the
  // exported categorySemanticTokens), so a drifted export fails the family contract.
  if (head.type === 'category-grid') return [categoryData.headClip];
  return null;
}

// The head's COMPLETE authored rule-id set, collected DIRECTLY from BOTH the head's
// resolved rulesContext AND rulesCode sections (every BibleRule.id in each) — not via
// a rule-prefix heuristic over a whole-bible walk (Codex H1, 2026-07-10). The guard's
// EXACT head-rule-id rejection consumes this: because it matches exact strings, it is
// independent of the head's computed rule prefix, so a head whose prefix is too short
// for the broad substring scan (the habits head's 'h') is still fully covered.
// Collecting straight from the two rule sections also means a head rule id that does
// not start with the computed prefix is captured just the same — no short-prefix or
// prefix-shape assumption survives in the set the exact rejection trusts.
function headRuleIds(head: BeatEntry): string[] {
  const bible = resolveBeatStructure(head.id).bible as Record<string, unknown> | null | undefined;
  const ids = new Set<string>();
  for (const key of ['rulesContext', 'rulesCode']) {
    const section = bible?.[key];
    if (!Array.isArray(section)) continue;
    for (const rule of section) {
      if (rule && typeof rule === 'object' && typeof (rule as { id?: unknown }).id === 'string')
        ids.add((rule as { id: string }).id);
    }
  }
  return [...ids];
}

const out = BEATS_SOURCE.map((beat) => {
  const resolved = resolveBeatStructure(beat.id);
  const head = beat.variantOf ? BEAT_BY_ID[beat.variantOf] : undefined;
  const headTokens = head
    ? {
        category: head.props?.category ?? null,
        clips: head.script.map((line) => line.clip).filter((c): c is string => Boolean(c)),
        rulePrefix: rulePrefix(head.id),
        // The head's COMPLETE authored rule-id set (both rule sections). The guard's
        // EXACT rule-id rejection matches these verbatim against a variant's rebuilt
        // rulesContext/rulesCode ids, unconditionally (any prefix length); the broad
        // substring ruleId scan additionally uses them for short-prefix families.
        ruleIds: headRuleIds(head),
        id: head.id,
        screenId: head.screenId ?? null,
        // Resolver-level SEMANTIC tokens (case-normalized) that free-text
        // substitution missed: the head's lowercased category noun, its
        // clip-family root, its beatId, and its category example label. No
        // NON-head variant may carry any of these (B1-R semantic guard). This is
        // the EXPORTED set the leak scan consumes.
        semanticTokens: headSemanticTokens(head),
        // The INDEPENDENT canonical set (recomputed from the typed family data, not
        // via the exported *SemanticTokens). The guard asserts semanticTokens ===
        // this. null => this head family has no registered typed contract to verify.
        canonicalSemanticTokens: headCanonicalSemanticTokens(head),
      }
    : null;
  return {
    id: beat.id,
    type: beat.type,
    variantOf: beat.variantOf ?? null,
    // the variant's OWN screenId, for the guard's namespace-prefix leak exemption
    // (a head id / screenId that is a prefix of the variant's own is not a leak).
    screenId: beat.screenId ?? null,
    hasOwnBible: Boolean(beat.bible),
    // section keys the beat AUTHORS itself (manifest excluded)
    ownBibleKeys: beat.bible ? Object.keys(beat.bible).filter((k) => k !== 'sectionManifest') : [],
    resolvedManifest: resolved.sectionManifest ?? resolved.bible?.sectionManifest ?? null,
    resolvedBible: resolved.bible ?? null,
    derivedSections: resolved.derivedSections ?? [],
    // sections a variant inherited via FREE-TEXT substitution (substituteDeep,
    // resolver step 4) rather than a typed per-family builder. The family guard
    // in bible-registry-check reads this: a category-sensitive key appearing here
    // means the variant is on the unsafe substitution path for that family.
    inheritedSections: resolved.inheritedSections ?? [],
    // for the guard's leak scan: the head tokens that must NOT survive onto a
    // variant's derived sections (category label, clip ids, rule-id prefix,
    // beatId, screenId).
    headTokens,
  };
});

process.stdout.write(JSON.stringify(out));

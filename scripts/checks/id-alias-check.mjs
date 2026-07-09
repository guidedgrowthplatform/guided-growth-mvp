// Registry id: id-alias-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "beatId alias map generated + unique".
//
// What this enforces, grounded in the beatsSource.ts identity-section watchOut
// text authored on category-women / goals-sleep and in deriveVariantIdentity:
//   1. Every beat's own top-level `id` is globally unique (BEAT_BY_ID does a
//      silent last-write-wins Object.fromEntries; a duplicate id would make one
//      beat invisible to the render with no error).
//   2. On any beat that authors its own bible.identity: the row labeled
//      "beatId (canonical)" must literally equal the beat's own id (catches a
//      copy-paste identity block pointing at the wrong beat).
//   3. On any beat that authors its own bible.identity: the three
//      "identity of THIS row in the running system" aliases (persisted
//      current_step, session_log value, data-beat-id) must equal the beat's own
//      id. This is the exact convention both exemplars declare and the one
//      deriveVariantIdentity() encodes for generated variants.
//   4. Alias VALUES for any surface other than `screenId` must be unique across
//      beats. `screenId` sharing is explicitly documented and allowed (e.g.
//      category / category-women share ONBOARD-BEGINNER-01; the 8 goals-*
//      beats share ONBOARD-BEGINNER-02 with a --CATEGORY screenId suffix), so a
//      duplicate screenId alone is not a violation. Any OTHER surface
//      (route / persisted current_step / session_log value / data-beat-id)
//      colliding across two different beatIds is a real bug: two beats would
//      resolve to the same alias in the app.

import { loadBeats, ownBibleBeats, report } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();

// 1. Global beatId uniqueness.
const idSeen = new Map();
for (const { beatId, line } of beats) {
  if (!beatId) {
    problems.push(`beat at line ${line}: missing top-level id`);
    continue;
  }
  if (idSeen.has(beatId)) {
    problems.push(
      `duplicate beatId "${beatId}": first at line ${idSeen.get(beatId)}, again at line ${line} ` +
        `(BEAT_BY_ID would silently drop one of these)`,
    );
    continue;
  }
  idSeen.set(beatId, line);
}

const bibleBeats = ownBibleBeats(beats);

// 2/3. Self-referential identity rows/aliases.
const SELF_ALIAS_SURFACES = ['persisted current_step', 'session_log value', 'data-beat-id'];
// alias surface -> Map<value, beatId> for global cross-beat uniqueness (excl. screenId).
const aliasValueOwners = new Map(); // surface -> Map<value, beatId>

for (const { beatId, value: beat, line } of bibleBeats) {
  const identity = beat.bible.identity;
  if (!identity) continue; // sectionManifest may legitimately mark this { na } / pending; not this check's job

  const rows = identity.rows ?? [];
  const canonicalRow = rows.find((r) => r.label === 'beatId (canonical)');
  if (!canonicalRow) {
    problems.push(`${beatId} (line ${line}): identity.rows has no "beatId (canonical)" row`);
  } else if (canonicalRow.value !== beatId) {
    problems.push(
      `${beatId} (line ${line}): identity row "beatId (canonical)" says "${canonicalRow.value}", ` +
        `expected the beat's own id "${beatId}"`,
    );
  }

  const aliases = identity.aliases ?? [];
  for (const surface of SELF_ALIAS_SURFACES) {
    const alias = aliases.find((a) => a.surface === surface);
    if (!alias) {
      problems.push(`${beatId} (line ${line}): identity.aliases is missing the "${surface}" surface`);
      continue;
    }
    if (alias.value !== beatId) {
      problems.push(
        `${beatId} (line ${line}): identity.aliases["${surface}"] = "${alias.value}", ` +
          `expected the beat's own id "${beatId}"`,
      );
    }
  }

  // 4. Cross-beat alias-value uniqueness, screenId exempted by design.
  for (const alias of aliases) {
    if (alias.surface === 'screenId') continue;
    if (!aliasValueOwners.has(alias.surface)) aliasValueOwners.set(alias.surface, new Map());
    const owners = aliasValueOwners.get(alias.surface);
    const priorOwner = owners.get(alias.value);
    if (priorOwner && priorOwner !== beatId) {
      problems.push(
        `alias collision on surface "${alias.surface}" value "${alias.value}": ` +
          `owned by both "${priorOwner}" and "${beatId}" (every beat's other-surface aliases must be unique)`,
      );
      continue;
    }
    owners.set(alias.value, beatId);
  }
}

report(
  problems,
  `id-alias-check passed: ${idSeen.size} unique beatId(s) across ${beats.length} beat(s); ` +
    `${bibleBeats.length} bible-bearing beat(s) verified self-referential + cross-beat alias uniqueness.`,
);

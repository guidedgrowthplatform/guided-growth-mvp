// Guard family: ID-ALIAS (render-bible section 1, identity).
// One canonical beatId generates every alias surface (screenId, route,
// persisted current_step, session_log value, data-beat-id). Drift between
// those surfaces is how resume/advance/logs/guards end up keying off
// different identities (system-audit finding 7). Structural checks always
// run; alias-contract checks run per beat once its bible.identity is filled
// (shape per !531). Unfilled beats report as coverage gaps.

import { loadBeatsSource, report } from './render-guards-lib.mjs';

const REQUIRED_ALIAS_SURFACES = [
  'screenId',
  'route',
  'persisted current_step',
  'session_log value',
  'data-beat-id',
];
// Alias surfaces whose value IS the canonical beatId.
const BEAT_ID_SURFACES = ['persisted current_step', 'session_log value', 'data-beat-id'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const { beats, exportedNames } = await loadBeatsSource(process.argv[2]);

const problems = [];
const gaps = [];

for (const name of ['BEAT_BY_ID', 'BEAT_BY_SCREEN_ID']) {
  if (!exportedNames.has(name)) {
    problems.push(
      `derived map ${name} missing from beatsSource.ts (one source generates all maps)`,
    );
  }
}

const seenIds = new Set();
const seenOrders = new Set();
for (const beat of beats) {
  if (seenIds.has(beat.id)) problems.push(`duplicate beatId "${beat.id}"`);
  seenIds.add(beat.id);
  if (!KEBAB.test(beat.id ?? '')) problems.push(`beatId "${beat.id}" is not kebab-case`);
  if (seenOrders.has(beat.order))
    problems.push(`duplicate order ${beat.order} (beat "${beat.id}")`);
  seenOrders.add(beat.order);
}

// Cross-beat: a beatId-valued alias claimed by two beats is two identities
// resolving to one persisted key.
const surfaceClaims = new Map();

let filled = 0;
for (const beat of beats) {
  const identity = beat.bible?.identity;
  if (!identity) {
    gaps.push(`${beat.id}: bible.identity not filled (id-alias contract pending)`);
    continue;
  }
  filled += 1;
  const aliases = new Map((identity.aliases ?? []).map((a) => [a?.surface, a?.value]));
  for (const surface of REQUIRED_ALIAS_SURFACES) {
    const value = aliases.get(surface);
    if (typeof value !== 'string' || !value.trim()) {
      problems.push(`${beat.id}: identity alias "${surface}" missing or empty`);
      continue;
    }
    if (BEAT_ID_SURFACES.includes(surface) && value !== beat.id) {
      problems.push(
        `${beat.id}: alias "${surface}" is "${value}" but must equal the canonical beatId`,
      );
    }
    if (BEAT_ID_SURFACES.includes(surface)) {
      const key = `${surface}:${value}`;
      if (surfaceClaims.has(key)) {
        problems.push(
          `${beat.id}: alias "${surface}"="${value}" already claimed by beat "${surfaceClaims.get(key)}"`,
        );
      }
      surfaceClaims.set(key, beat.id);
    }
  }
  const rows = new Map((identity.rows ?? []).map((r) => [r?.label, r?.value]));
  const expectRow = (label, expected) => {
    if (!rows.has(label)) return;
    if (String(rows.get(label)) !== String(expected)) {
      problems.push(
        `${beat.id}: identity row "${label}" says "${rows.get(label)}" but the source field is "${expected}"`,
      );
    }
  };
  expectRow('beatId (canonical)', beat.id);
  expectRow('name', beat.name);
  expectRow('order', beat.order);
  expectRow('path', beat.path);
  expectRow('type', beat.type);
  const aliasScreen = aliases.get('screenId');
  if (beat.screenId && aliasScreen && aliasScreen !== beat.screenId) {
    problems.push(
      `${beat.id}: alias screenId "${aliasScreen}" does not match source screenId "${beat.screenId}"`,
    );
  }
}

report('ID-ALIAS check', {
  problems,
  gaps,
  passMsg: `${beats.length} beats structurally unique, ${filled} alias contract(s) verified.`,
});

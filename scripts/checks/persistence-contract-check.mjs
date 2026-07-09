// Registry id: persistence-contract-check
// Meaning (ENFORCER_REGISTRY, flowBible.ts): "bible persistence rows match
// handler writes".
//
// There is no standalone app-side write-handler manifest yet (both owner beats'
// persistence.watchOut sections explicitly flag the exact table/column as
// app-reconcile work). Until that exists, this enforces the cross-checkable
// half within the beat's own authored contract:
//   1. bible.persistence.rows must declare a non-empty "writes" row — a filled
//      persistence section with nothing said about what it writes is not a
//      contract.
//   2. Every key the beat's own io.dataOut declares must be traceable in the
//      persistence section text (at minimum, the key's final dot-segment,
//      e.g. "onboarding.category" -> "category"). A beat whose io says it
//      writes something the persistence section never mentions is exactly the
//      drift this registry entry exists to catch — io and persistence
//      describing two different realities.

import { ownBibleBeats, loadBeats, report } from './lib/beats-ast.mjs';

const problems = [];

const { beats } = await loadBeats();
const bibleBeats = ownBibleBeats(beats);

for (const { beatId, value: beat, line } of bibleBeats) {
  const persistence = beat.bible.persistence;
  if (!persistence || !Array.isArray(persistence.rows) || persistence.rows.length === 0) continue;

  const writesRow = persistence.rows.find((r) => r.label === 'writes');
  if (!writesRow || !writesRow.value || !writesRow.value.trim()) {
    problems.push(`${beatId} (line ${line}): bible.persistence.rows has no non-empty "writes" row`);
    continue;
  }

  const combined = persistence.rows.map((r) => `${r.label}: ${r.value}`).join(' | ');
  const dataOut = beat.io?.dataOut ?? [];

  for (const datum of dataOut) {
    if (typeof datum.key !== 'string' || !datum.key.includes('.')) continue;
    const tail = datum.key.split('.').pop();
    if (tail && !combined.toLowerCase().includes(tail.toLowerCase())) {
      problems.push(
        `${beatId} (line ${line}): io.dataOut declares "${datum.key}" but bible.persistence never ` +
          `mentions "${tail}" — persistence rows and the io contract describe different writes`,
      );
    }
  }
}

report(
  problems,
  `persistence-contract-check passed: ${bibleBeats.length} bible-bearing beat(s) checked, ` +
    `every declared io.dataOut write is reflected in bible.persistence.`,
);

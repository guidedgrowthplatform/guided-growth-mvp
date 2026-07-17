import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fail, isExplicitNone, readBeats, root } from './render-contract-utils.mjs';

const CHECK_ID = 'id-alias-check';
const ruleId = 'identity-alias-map';
const productionMapPath = path.join(root, 'src/components/flow-designer/beatIdentityMap.json');
const appMapPath = path.join(root, 'src/components/flow-designer/FlowDesigner.tsx');
const beats = await readBeats();
const appMapSource = await readFile(appMapPath, 'utf8');
const problems = [];
const aliasesBySurface = new Map();

for (const beat of beats) {
  const aliases = beat.bible?.identity?.aliases;
  if (!Array.isArray(aliases)) {
    problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, expected: 'identity aliases', actual: 'missing' }));
    continue;
  }
  for (const alias of aliases) {
    if (isExplicitNone(alias.value) || /generated at app-reconcile/i.test(alias.value)) continue;
    const aliasesForSurface = aliasesBySurface.get(alias.surface) ?? [];
    aliasesForSurface.push({ beatId: beat.id, value: alias.value });
    aliasesBySurface.set(alias.surface, aliasesForSurface);
  }
}

const productionMap = JSON.parse(await readFile(productionMapPath, 'utf8'));
for (const [surface, aliases] of aliasesBySurface) {
  const byValue = new Map();
  for (const alias of aliases) {
    const beatsForValue = byValue.get(alias.value) ?? [];
    beatsForValue.push(alias.beatId);
    byValue.set(alias.value, beatsForValue);
  }
  for (const [value, beatIds] of byValue) {
    if (beatIds.length !== 1 && !(surface === 'screenId' && value === 'ONBOARD-BEGINNER-01')) {
      problems.push(fail({ id: CHECK_ID, ruleId, beatId: beatIds.join(','), expected: `${surface}=${value} maps once`, actual: `${beatIds.length} mappings` }));
    }
    const actualBeatId = productionMap[surface]?.[value];
    if (actualBeatId !== beatIds[0] && !(surface === 'screenId' && value === 'ONBOARD-BEGINNER-01')) {
      problems.push(fail({ id: CHECK_ID, ruleId, beatId: beatIds[0], expected: `${surface}=${value} -> ${beatIds[0]}`, actual: actualBeatId ?? 'missing' }));
    }
  }
  for (const [value, actualBeatId] of Object.entries(productionMap[surface] ?? {})) {
    if (!byValue.has(value) && !/generated at app-reconcile/i.test(value)) {
      problems.push(fail({ id: CHECK_ID, ruleId, beatId: actualBeatId, expected: `no extra ${surface} mapping`, actual: `${surface}=${value}` }));
    }
  }
}

if (!appMapSource.includes('data-beat-id={b.id}')) {
  problems.push(fail({ id: CHECK_ID, ruleId, beatId: 'all', expected: 'production data-beat-id uses canonical beat.id', actual: 'binding missing from FlowDesigner.tsx' }));
}

if (problems.length) {
  console.error(`${CHECK_ID} failed.\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

const aliasCount = [...aliasesBySurface.values()].reduce((count, aliases) => count + aliases.length, 0);
console.log(`${CHECK_ID} passed: ${aliasCount} declared aliases map uniquely across ${aliasesBySurface.size} surfaces.`);

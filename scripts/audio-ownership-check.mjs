import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fail, readBeats, root } from './render-contract-utils.mjs';

const CHECK_ID = 'audio-ownership-check';
const ruleId = 'audio-selection-contract';
const productionMapPath = path.join(root, 'src/components/flow-designer/beatAudioSelectionMap.json');
const beats = await readBeats();
const selections = JSON.parse(await readFile(productionMapPath, 'utf8'));
const problems = [];

async function assetExists(clipPath) {
  if (!clipPath?.startsWith('/voice/')) return false;
  try {
    await access(path.join(root, 'public', clipPath));
    return true;
  } catch {
    return false;
  }
}

for (const beat of beats) {
  for (const line of beat.script ?? []) {
    const key = `${beat.id}:${line.seq}`;
    const actual = selections[key];
    const expectedEngine = line.voice ?? 'silent';
    if (!actual) {
      problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: `${expectedEngine} selection`, actual: 'missing' }));
      continue;
    }
    if (actual.engine !== expectedEngine) {
      problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: `engine=${expectedEngine}`, actual: `engine=${actual.engine}` }));
    }
    if (line.voice === 'mp3') {
      if (!line.clipPath || !(await assetExists(line.clipPath))) {
        problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: 'recorded line with existing declared asset', actual: line.clipPath ?? 'no clipPath' }));
      }
      if (actual.clipPath !== line.clipPath || actual.liveSlots?.length) {
        problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: `recorded asset=${line.clipPath}, liveSlots=[]`, actual: `asset=${actual.clipPath ?? 'none'}, liveSlots=${JSON.stringify(actual.liveSlots ?? [])}` }));
      }
    } else if (line.voice === 'cartesia') {
      const slots = [...String(line.words ?? '').matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      if (!slots.length || line.clipPath || line.clip) {
        problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: 'live line has permitted slot and no recorded assertion', actual: `slots=${JSON.stringify(slots)}, clip=${line.clip ?? 'none'}, clipPath=${line.clipPath ?? 'none'}` }));
      }
      if (JSON.stringify(actual.liveSlots ?? []) !== JSON.stringify(slots) || actual.clipPath) {
        problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: `live slots=${JSON.stringify(slots)}, asset=none`, actual: `liveSlots=${JSON.stringify(actual.liveSlots ?? [])}, asset=${actual.clipPath ?? 'none'}` }));
      }
    } else if (line.voice === null) {
      if (actual.engine !== 'silent' || actual.clipPath || actual.liveSlots?.length) {
        problems.push(fail({ id: CHECK_ID, ruleId, beatId: beat.id, seq: line.seq, expected: 'silent selects no audio', actual: JSON.stringify(actual) }));
      }
    }
  }
}

for (const key of Object.keys(selections)) {
  const separator = key.lastIndexOf(':');
  const beatId = key.slice(0, separator);
  const seq = key.slice(separator + 1);
  if (!beats.some((beat) => beat.id === beatId && (beat.script ?? []).some((line) => String(line.seq) === seq))) {
    problems.push(fail({ id: CHECK_ID, ruleId, beatId, seq, expected: 'no extra production audio selection', actual: key }));
  }
}

if (problems.length) {
  console.error(`${CHECK_ID} failed.\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`${CHECK_ID} passed: ${Object.keys(selections).length} production line selections match authored audio ownership.`);

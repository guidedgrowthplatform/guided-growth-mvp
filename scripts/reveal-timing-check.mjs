import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fail, readBeats, root, ruleEntries } from './render-contract-utils.mjs';

const CHECK_ID = 'reveal-timing-check';
const narrationPath = path.join(root, 'src/components/flow-designer/beatNarration.ts');
const narration = await readFile(narrationPath, 'utf8');
const beats = await readBeats();
const problems = [];
const targetPattern = /reveal-(\d+)/g;
const wordingPattern = /(reveal|blooms?|gated?).*(clip end|prior line|never a fixed timer)|(clip end|prior line).*(reveal|blooms?|gated?)/i;

for (const beat of beats) {
  for (const rule of ruleEntries(beat)) {
    if (!wordingPattern.test(String(rule.rule)) || !(rule.enforcedBy ?? []).includes(CHECK_ID)) continue;
    const targets = [...String(rule.rule).matchAll(targetPattern)].map((match) => Number(match[1]));
    const componentLines = (beat.script ?? []).filter((line) => line.bindsTo?.kind === 'component');
    const expectedTargets = targets.length
      ? targets
      : componentLines.map((line) => /^reveal-(\d+)$/.exec(line.bindsTo?.element ?? '')).filter(Boolean).map((match) => Number(match[1]));
    if (!expectedTargets.length) {
      const opener = (beat.script ?? []).find((line) => line.seq === 1);
      if (opener?.voice !== 'mp3' || !opener.clipPath) {
        problems.push(fail({ id: CHECK_ID, ruleId: rule.id, beatId: beat.id, seq: 1, expected: 'recorded opener gates grid/card reveal', actual: opener ? `voice=${opener.voice}, clipPath=${opener.clipPath ?? 'none'}` : 'missing' }));
      }
      continue;
    }
    for (const target of expectedTargets) {
      const line = componentLines.find((candidate) => candidate.bindsTo?.element === `reveal-${target}`);
      if (!line) {
        problems.push(fail({ id: CHECK_ID, ruleId: rule.id, beatId: beat.id, expected: `script target reveal-${target}`, actual: 'missing' }));
        continue;
      }
      const priorLine = (beat.script ?? []).find((candidate) => candidate.seq === line.seq - 1);
      if (!priorLine || priorLine.voice !== 'mp3' || !priorLine.clipPath) {
        problems.push(fail({ id: CHECK_ID, ruleId: rule.id, beatId: beat.id, seq: line.seq, expected: 'prior recorded line gates reveal', actual: priorLine ? `seq ${priorLine.seq} voice=${priorLine.voice}` : 'no prior line' }));
      }
    }
  }
}

if (!/if \(reveal != null\) setElementReveal\(reveal\);[\s\S]{0,180}if \(line\.words\) await playLine\(line, muted\);/.test(narration)) {
  problems.push(fail({ id: CHECK_ID, ruleId: 'runtime-audio-order', beatId: 'all', expected: 'ended(seq) reveals target after audio completion', actual: 'beatNarration source does not prove callback ordering' }));
}
if (/await wait\(\d+\);\s*if \(reveal != null\) setElementReveal\(reveal\);/.test(narration)) {
  problems.push(fail({ id: CHECK_ID, ruleId: 'runtime-no-fixed-timer', beatId: 'all', expected: 'no fixed timer before reveal', actual: 'timer-based reveal detected' }));
}

if (problems.length) {
  console.error(`${CHECK_ID} failed.\n`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`${CHECK_ID} passed: authored reveal rules are bound to prior recorded-line completion, without timer-only reveal paths.`);

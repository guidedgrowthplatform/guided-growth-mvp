#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const NEW_SHA = '9c0019f70560e4aa8ffa995f808315b4c87b4857';
const BEATS_PATH = 'src/components/flow-designer/beatsSource.ts';
const FLOW_BIBLE_PATH = 'src/components/flow-designer/flowBible.ts';
const MAP_PATH = 'gg-spec/docs/beat-rename/beat-rename-map.json';
const COPY_FIELDS = ['id', 'name', 'order', 'path', 'type', 'hideOrb', 'props', 'elements'];
const require = createRequire(import.meta.url);

function fail(message) {
  throw new Error(message);
}

function gitShow(revision, file) {
  return execFileSync('git', ['show', `${revision}:${file}`], { cwd: ROOT, encoding: 'utf8' });
}

function loadModule(source, file) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', js)(
    module.exports,
    require,
    module,
    file,
    ROOT,
  );
  return module.exports;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function projection(beat) {
  return {
    ...Object.fromEntries(COPY_FIELDS.map((field) => [field, beat[field]])),
    script: beat.script.map((line) => ({
      seq: line.seq,
      words: line.words,
      bindsTo: line.bindsTo,
      voice: line.voice,
      clip: line.clip,
      clipPath: line.clipPath,
      expectedUser: line.expectedUser,
    })),
  };
}

function checkTypesOnly() {
  const file = path.join(ROOT, FLOW_BIBLE_PATH);
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  for (const statement of ast.statements) {
    if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) {
      fail(`types-only: forbidden ${ts.SyntaxKind[statement.kind]} in ${FLOW_BIBLE_PATH}`);
    }
  }
}

function main() {
  checkTypesOnly();
  const baseline = loadModule(gitShow(NEW_SHA, BEATS_PATH), 'baseline.ts').BEATS_SOURCE;
  const target = loadModule(readFileSync(path.join(ROOT, BEATS_PATH), 'utf8'), 'target.ts').BEATS_SOURCE;
  const map = JSON.parse(readFileSync(path.join(ROOT, MAP_PATH), 'utf8'));
  if (baseline.length !== 62 || target.length !== 62) fail(`structure: expected 62 beats, got N=${baseline.length}, target=${target.length}`);
  if (new Set(target.map((beat) => beat.id)).size !== 62) fail('structure: target IDs are not unique');
  const baselineById = new Map(baseline.map((beat) => [beat.id, beat]));
  const targetById = new Map(target.map((beat) => [beat.id, beat]));
  if (JSON.stringify([...baselineById.keys()]) !== JSON.stringify([...targetById.keys()])) fail('structure: target ID sequence differs from N');

  const expected = new Map(baseline.map((beat) => [beat.id, projection(beat)]));
  expected.get('onboarding-beat-6-profile:greeting').script[0].words =
    'Awesome {name}, two quick things so I can tailor this to you.';
  expected.get('onboarding-beat-6-profile:asks').script[0].words =
    'How old are you, and how do you identify?';
  for (const [id, value] of expected) {
    if (JSON.stringify(canonical(value)) !== JSON.stringify(canonical(projection(targetById.get(id))))) {
      fail(`locked copy: ${id} differs from N outside the two sanctioned rulings`);
    }
  }

  for (const beat of target) {
    if (!beat.bible || !beat.io) fail(`rich data: ${beat.id} is missing bible or io`);
    if (!['MP3', 'Cartesia', 'Vapi', 'Silent'].includes(beat.voiceEngine)) fail(`matrix: ${beat.id}.voiceEngine`);
    if (beat.voiceEngine !== 'Silent' && beat.voiceMode === 'Verbatim' && !beat.spokenContent && !beat.script.length) {
      fail(`matrix: ${beat.id} has no spoken content`);
    }
    if (beat.id.includes(':') && !beat.parent) fail(`parent: ${beat.id} has no display parent`);
  }
  for (const row of map) {
    if (!targetById.has(row.targetId)) fail(`Rename Map: missing target ${row.targetId}`);
  }

  for (const oldId of ['state-check', 'checkin', 'reflection', 'goal-custom', 'habit-custom', 'schedule', 'advanced-capture', 'advanced-frequency', 'plan']) {
    const targetId = map.find((row) => row.oldId === oldId)?.targetId;
    const io = targetById.get(targetId)?.io;
    if (!io || !Array.isArray(io.dataIn) || !Array.isArray(io.dataOut)) fail(`coverage persistence: ${oldId}`);
  }
  for (const oldId of ['checkin', 'goal-custom', 'habit-custom']) {
    const targetId = map.find((row) => row.oldId === oldId)?.targetId;
    if (!targetById.get(targetId)?.bible?.allowedTools) fail(`coverage tools: ${oldId}`);
  }
  for (const oldId of ['weekly-blank', 'weekly-full', 'weekly-p78', 'weekly-p36', 'weekly-gaps']) {
    const targetId = map.find((row) => row.oldId === oldId)?.targetId;
    if (!targetById.get(targetId)?.bible?.components) fail(`coverage components: ${oldId}`);
  }
  try {
    execFileSync('git', ['grep', '-nF', 'beatMetadata'], { cwd: ROOT, stdio: 'pipe' });
    fail('consumer: tracked beatMetadata reference remains');
  } catch (error) {
    if (error.message?.includes('consumer:')) throw error;
  }
  console.log('Objective 1 verified: 62 beats, locked-copy delta count 2, rich contracts and coverage complete.');
}

main();

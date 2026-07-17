#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const NEW_SHA = '9c0019f70560e4aa8ffa995f808315b4c87b4857';
const BEATS_PATH = 'src/components/flow-designer/beatsSource.ts';
const BASELINE_PATH = 'scripts/verify-objective1-baseline.json';
const FLOW_BIBLE_PATH = 'src/components/flow-designer/flowBible.ts';
const MAP_PATH = 'gg-spec/docs/beat-rename/beat-rename-map.json';
// This deliberately locks only verbatim user-facing copy: script words and
// component opener text. Context and tool contracts are excluded because the
// consolidation intentionally enriched them beyond the pinned original.
const COPY_FIELDS = ['id', 'name', 'order', 'path', 'type', 'hideOrb', 'props', 'elements'];
const SANCTIONED_DELTAS = [
  {
    path: 'onboarding-beat-6-profile:greeting.script[0].words',
    old: 'Good to meet you, {name}. Two quick things so I can tailor this to you.',
    new: 'Awesome {name}, two quick things so I can tailor this to you.',
  },
  {
    path: 'onboarding-beat-6-profile:asks.script[0].words',
    old: 'How old are you?',
    new: 'How old are you, and how do you identify?',
  },
];
const require = createRequire(import.meta.url);

function fail(message) {
  throw new Error(message);
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

function gitShow(revision, file) {
  return execFileSync('git', ['show', `${revision}:${file}`], { cwd: ROOT, encoding: 'utf8' });
}

function hasGitRepository() {
  return existsSync(path.join(ROOT, '.git'));
}

function loadBaseline() {
  const snapshot = path.join(ROOT, BASELINE_PATH);
  if (existsSync(snapshot)) return JSON.parse(readFileSync(snapshot, 'utf8'));
  if (!hasGitRepository()) {
    fail(`baseline: missing ${BASELINE_PATH}; no .git checkout is available for fallback`);
  }
  return loadModule(gitShow(NEW_SHA, BEATS_PATH), 'baseline.ts').BEATS_SOURCE.map(projection);
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

function diffValues(oldValue, newValue, fieldPath, deltas) {
  if (JSON.stringify(canonical(oldValue)) === JSON.stringify(canonical(newValue))) return;
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const count = Math.max(oldValue.length, newValue.length);
    for (let index = 0; index < count; index += 1) {
      diffValues(oldValue[index], newValue[index], `${fieldPath}[${index}]`, deltas);
    }
    return;
  }
  if (oldValue && newValue && typeof oldValue === 'object' && typeof newValue === 'object') {
    const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    for (const key of [...keys].sort()) diffValues(oldValue[key], newValue[key], `${fieldPath}.${key}`, deltas);
    return;
  }
  deltas.push({ path: fieldPath, old: oldValue, new: newValue });
}

function lockedCopyDeltas(baseline, target) {
  const targetById = new Map(target.map((beat) => [beat.id, projection(beat)]));
  const deltas = [];
  for (const oldBeat of baseline) {
    const newBeat = targetById.get(oldBeat.id);
    if (!newBeat) {
      deltas.push({ path: `${oldBeat.id}`, old: 'present', new: 'missing' });
      continue;
    }
    diffValues(oldBeat, newBeat, oldBeat.id, deltas);
  }
  return deltas;
}

function assertExpectedDeltas(deltas) {
  for (const delta of deltas) {
    console.log(`locked-copy delta: ${delta.path}\n  old: ${JSON.stringify(delta.old)}\n  new: ${JSON.stringify(delta.new)}`);
  }
  if (JSON.stringify(deltas) !== JSON.stringify(SANCTIONED_DELTAS)) {
    fail(
      `locked copy: expected exactly ${JSON.stringify(SANCTIONED_DELTAS, null, 2)}, got ${JSON.stringify(deltas, null, 2)}`,
    );
  }
}

function trackedSourceFiles(directory) {
  const ignored = new Set(['.git', 'node_modules', 'dist', 'dist-flow', 'coverage']);
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) files.push(...trackedSourceFiles(fullPath));
    else if (/\.(?:[cm]?[jt]sx?)$/.test(entry)) files.push(fullPath);
  }
  return files;
}

function checkNoLegacyConsumer() {
  const offenders = trackedSourceFiles(ROOT).filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /(?:from|import)\s+.*["'][^"']*beatMetadata/.test(source);
  });
  if (offenders.length) fail(`consumer: tracked beatMetadata import remains in ${offenders.join(', ')}`);
}

function main() {
  checkTypesOnly();
  const baseline = loadBaseline();
  const target = loadModule(readFileSync(path.join(ROOT, BEATS_PATH), 'utf8'), 'target.ts').BEATS_SOURCE;
  const map = JSON.parse(readFileSync(path.join(ROOT, MAP_PATH), 'utf8'));
  if (baseline.length !== 62 || target.length !== 62) {
    fail(`structure: expected 62 beats, got baseline=${baseline.length}, target=${target.length}`);
  }
  if (new Set(target.map((beat) => beat.id)).size !== 62) fail('structure: target IDs are not unique');
  const baselineIds = baseline.map((beat) => beat.id);
  const targetIds = target.map((beat) => beat.id);
  if (JSON.stringify(baselineIds) !== JSON.stringify(targetIds)) fail('structure: target ID sequence differs from baseline');
  assertExpectedDeltas(lockedCopyDeltas(baseline, target));

  const targetById = new Map(target.map((beat) => [beat.id, beat]));
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
  checkNoLegacyConsumer();
  console.log('Objective 1 verified: 62 beats, exactly 2 locked-copy deltas, rich contracts and coverage complete.');
}

main();

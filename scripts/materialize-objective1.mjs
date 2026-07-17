#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const NEW_SHA = '9c0019f70560e4aa8ffa995f808315b4c87b4857';
const RICH_SHA = 'e0e7f5438ac205ca868cac5d0b45af16ddf8aa8b';
const BEATS_PATH = 'src/components/flow-designer/beatsSource.ts';
const MAP_PATH = 'gg-spec/docs/beat-rename/beat-rename-map.json';
const targetPath = new URL('../src/components/flow-designer/beatsSource.ts', import.meta.url);
const renameScriptPath = new URL('./beat-rename/stage1_relabel_ids.py', import.meta.url);
const require = createRequire(import.meta.url);

function gitShow(revision, path) {
  return execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' });
}

function sourceArray(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  let array;
  sourceFile.forEachChild((node) => {
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations.find(
        (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === 'BEATS_SOURCE',
      );
      const initializer = declaration?.initializer;
      const value = initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer;
      if (value && ts.isArrayLiteralExpression(value)) array = value;
    }
  });
  if (!array) throw new Error(`BEATS_SOURCE array not found in ${fileName}`);
  return { sourceFile, array };
}

function property(object, name) {
  return object.properties.find(
    (member) =>
      ts.isPropertyAssignment(member) &&
      ((ts.isIdentifier(member.name) && member.name.text === name) ||
        (ts.isStringLiteral(member.name) && member.name.text === name)),
  );
}

function stringProperty(object, name, sourceFile) {
  const member = property(object, name);
  if (!member || !ts.isStringLiteral(member.initializer)) {
    throw new Error(`Missing string ${name} in ${sourceFile.fileName}`);
  }
  return member.initializer.text;
}

function renameMap() {
  const rows = [];
  const regex = /^\s+"([^"]+)": "([^"]+)",$/gm;
  const renameSource = readFileSync(renameScriptPath, 'utf8');
  for (const match of renameSource.matchAll(regex)) rows.push({ oldId: match[1], targetId: match[2] });
  if (rows.length !== 62) throw new Error(`Expected 62 Rename Map rows, found ${rows.length}`);
  return rows;
}

function loadRichModule(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
    module.exports,
    require,
    module,
    'rich-objective1.ts',
    process.cwd(),
  );
  return module.exports;
}

function rewriteExactIds(value, oldToNew, path = []) {
  if (typeof value === 'string') {
    const isIdentityAlias = path.includes('identity') && path.includes('aliases');
    return !isIdentityAlias && oldToNew.has(value) ? oldToNew.get(value) : value;
  }
  if (Array.isArray(value)) return value.map((item, index) => rewriteExactIds(item, oldToNew, [...path, String(index)]));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteExactIds(item, oldToNew, [...path, key])]),
    );
  }
  return value;
}

function parentFor(targetId) {
  if (targetId.startsWith('onboarding-beat-6-profile:')) return 'onboarding-beat-6-profile';
  if (targetId.endsWith(':women')) return 'onboarding-beginner-beat-11-pick-category';
  if (targetId.startsWith('onboarding-beginner-beat-12-pick-goals:')) {
    return 'onboarding-beginner-beat-12-pick-goals';
  }
  if (targetId.startsWith('onboarding-beginner-beat-13-pick-habits:')) {
    return 'onboarding-beginner-beat-13-pick-habits';
  }
  if (targetId.startsWith('onboarding-beat-18-week-projection:')) {
    return 'onboarding-beat-18-week-projection';
  }
  return undefined;
}

function insertionFor(rich, resolveBeatStructure, oldToNew, targetId) {
  const resolved = resolveBeatStructure(rich.id);
  const fields = {
    ...(parentFor(targetId) ? { parent: parentFor(targetId) } : {}),
    ...(resolved.bible ? { bible: rewriteExactIds(resolved.bible, oldToNew) } : {}),
    ...(resolved.io ? { io: rewriteExactIds(resolved.io, oldToNew) } : {}),
  };
  return Object.keys(fields).length === 0 ? '' : `\n${JSON.stringify(fields, null, 2).slice(1, -1)},`;
}

function main() {
  const map = renameMap();
  const oldToNew = new Map(map.map(({ oldId, targetId }) => [oldId, targetId]));
  const richSource = gitShow(RICH_SHA, BEATS_PATH);
  const richModule = loadRichModule(richSource);
  const richById = new Map(richModule.BEATS_SOURCE.map((beat) => [beat.id, beat]));
  const baseline = gitShow(NEW_SHA, BEATS_PATH);
  const { sourceFile, array } = sourceArray(baseline, BEATS_PATH);
  const replacements = [];

  for (const element of array.elements) {
    if (!ts.isObjectLiteralExpression(element)) throw new Error('Expected an object literal beat entry');
    const targetId = stringProperty(element, 'id', sourceFile);
    const oldId = map.find((row) => row.targetId === targetId)?.oldId;
    if (!oldId) throw new Error(`No Rename Map row for ${targetId}`);
    const rich = richById.get(oldId);
    if (!rich) throw new Error(`No rich beat for ${oldId}`);
    const end = element.getEnd() - 1;
    replacements.push({
      start: end,
      end,
      text: insertionFor(rich, richModule.resolveBeatStructure, oldToNew, targetId),
    });
  }

  let output = baseline;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  }
  output = `import type { BeatIO, BibleSections } from './flowBible';\n\n${output}`;
  output = output.replace(
    '  readonly script: readonly ScriptLine[];\n}',
    '  readonly script: readonly ScriptLine[];\n  readonly parent?: string;\n  readonly bible?: BibleSections;\n  readonly io?: BeatIO;\n}',
  );
  writeFileSync(targetPath, output);
  const mapPath = new URL(`../${MAP_PATH}`, import.meta.url);
  mkdirSync(new URL('../gg-spec/docs/beat-rename/', import.meta.url), { recursive: true });
  writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);
  console.log(`Materialized ${replacements.length} rich beat records and wrote ${map.length} Rename Map rows.`);
}

main();

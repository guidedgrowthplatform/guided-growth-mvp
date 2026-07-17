#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const NEW_SHA = '9c0019f70560e4aa8ffa995f808315b4c87b4857';
const BEATS_PATH = 'src/components/flow-designer/beatsSource.ts';
const METADATA_PATH = 'src/components/flow-designer/beatMetadata.ts';
const targetPath = new URL('../src/components/flow-designer/beatsSource.ts', import.meta.url);
const require = createRequire(import.meta.url);
const uniqueFields = new Set([
  'spokenContent',
  'variable',
  'openerMode',
  'openerShowsAsBubble',
  'perElement',
]);

function gitShow(revision, path) {
  return execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' });
}

function loadMetadata() {
  const source = gitShow(NEW_SHA, METADATA_PATH);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
    module.exports,
    require,
    module,
    'beatMetadata.ts',
    process.cwd(),
  );
  return module.exports.BEAT_METADATA;
}

function sourceArray(sourceText) {
  const sourceFile = ts.createSourceFile(BEATS_PATH, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === 'BEATS_SOURCE');
  const initializer = declaration?.initializer;
  const value = initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer;
  if (!value || !ts.isArrayLiteralExpression(value)) throw new Error('BEATS_SOURCE array not found');
  return { sourceFile, array: value };
}

function idFor(object, sourceFile) {
  const member = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ((ts.isIdentifier(candidate.name) && candidate.name.text === 'id') ||
        (ts.isStringLiteral(candidate.name) && candidate.name.text === 'id')),
  );
  if (!member || !ts.isStringLiteral(member.initializer)) throw new Error('Beat object is missing id');
  return member.initializer.text;
}

function targetIdsFor(metadataId, targetIds) {
  if (targetIds.has(metadataId)) return [metadataId];
  if (metadataId === 'onboarding-beginner-beat-12-pick-goals') {
    return [...targetIds].filter((id) => id.startsWith(`${metadataId}:`));
  }
  return [];
}

function main() {
  const source = readFileSync(targetPath, 'utf8');
  const { sourceFile, array } = sourceArray(source);
  const entries = array.elements.filter(ts.isObjectLiteralExpression);
  const byId = new Map(entries.map((entry) => [idFor(entry, sourceFile), entry]));
  const metadata = loadMetadata();
  const replacements = [];
  const dispositions = [];

  for (const [metadataId, record] of Object.entries(metadata)) {
    const targetIds = targetIdsFor(metadataId, new Set(byId.keys()));
    const fields = Object.fromEntries(Object.entries(record).filter(([key]) => uniqueFields.has(key)));
    if (targetIds.length === 0) {
      dispositions.push({ metadataId, disposition: 'Unreachable' });
      continue;
    }
    if (Object.keys(fields).length === 0) {
      dispositions.push({ metadataId, disposition: 'Superseded', targetIds });
      continue;
    }
    for (const targetId of targetIds) {
      const entry = byId.get(targetId);
      const end = entry.getEnd() - 1;
      replacements.push({ start: end, end, text: `\n${JSON.stringify(fields, null, 2).slice(1, -1)},` });
    }
    dispositions.push({ metadataId, disposition: 'Applied', targetIds });
  }

  let output = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  }
  output = output.replace(
    "import type { BeatIO, BibleSections } from './flowBible';",
    "import type { BeatElementLine, BeatIO, BibleSections } from './flowBible';",
  );
  output = output.replace(
    '  readonly parent?: string;\n  readonly bible?: BibleSections;',
    '  readonly parent?: string;\n  readonly spokenContent?: string;\n  readonly variable?: boolean;\n  readonly openerMode?: \'A\' | \'B\';\n  readonly openerShowsAsBubble?: boolean;\n  readonly perElement?: readonly BeatElementLine[];\n  readonly bible?: BibleSections;',
  );
  writeFileSync(targetPath, output);
  console.log(JSON.stringify(dispositions, null, 2));
}

main();

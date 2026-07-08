import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const outputPath = path.join(root, 'dist-flow/parity.json');
const headersPath = path.join(root, 'dist-flow/_headers');
const headers = `/
  Cache-Control: no-store
/index.html
  Cache-Control: no-store
/parity.json
  Cache-Control: no-store
  Content-Type: application/json; charset=utf-8
/play/*
  Cache-Control: no-store
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isObjectLiteralExpression(node)) return objectValue(node);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);

  throw new Error(`Unsupported BEATS literal: ${ts.SyntaxKind[node.kind]}`);
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  throw new Error(`Unsupported BEATS property name: ${ts.SyntaxKind[name.kind]}`);
}

function objectValue(node) {
  const out = {};
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      throw new Error(`Unsupported BEATS object member: ${ts.SyntaxKind[prop.kind]}`);
    }
    out[propertyName(prop.name)] = literalValue(prop.initializer);
  }
  return out;
}

function findBeatsSource(sourceFile) {
  let beatsArray = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'BEATS_SOURCE' &&
      node.initializer
    ) {
      // BEATS_SOURCE = [...] as const
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isArrayLiteralExpression(init)) {
        beatsArray = init;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!beatsArray) {
    throw new Error(`Could not find BEATS_SOURCE array in ${beatsSourcePath}`);
  }

  return beatsArray;
}

const beatsSourceText = await readFile(beatsSourcePath, 'utf8');

const sourceFile = ts.createSourceFile(
  beatsSourcePath,
  beatsSourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const beats = findBeatsSource(sourceFile).elements.map(literalValue);

// The opener is the first coach-bubble script line (the words the phone bubble
// reads), else the first script line with words. The one source is script[].
function firstOpener(beat) {
  const bubble = beat.script?.find((line) => line.bindsTo?.kind === 'bubble' && line.words);
  if (bubble) return bubble.words;
  const line = beat.script?.find((l) => l.words);
  return line ? line.words : null;
}

const exportBeats = beats.map((beat, index) => ({
  index: index + 1,
  screenId: beat.screenId ?? null,
  opener: firstOpener(beat),
  path: beat.path ?? null,
}));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      source: {
        beats: 'src/components/flow-designer/beatsSource.ts#BEATS_SOURCE',
      },
      beats: exportBeats,
    },
    null,
    2,
  )}\n`,
);
await writeFile(headersPath, headers);

console.log(`Wrote ${path.relative(root, outputPath)} with ${exportBeats.length} beats`);
console.log(`Wrote ${path.relative(root, headersPath)}`);

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const flowDesignerPath = path.join(root, 'src/components/flow-designer/FlowDesigner.tsx');
const metadataPath = path.join(root, 'src/components/flow-designer/onboardingMetadata.json');
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

function findBeatsArray(sourceFile) {
  let beatsArray = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'BASE_BEATS' || node.name.text === 'BEATS') &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      beatsArray = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!beatsArray) {
    throw new Error(`Could not find exported BEATS array in ${flowDesignerPath}`);
  }

  return beatsArray;
}

const [flowDesignerSource, metadataSource] = await Promise.all([
  readFile(flowDesignerPath, 'utf8'),
  readFile(metadataPath, 'utf8'),
]);

const sourceFile = ts.createSourceFile(
  flowDesignerPath,
  flowDesignerSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const beats = findBeatsArray(sourceFile).elements.map(literalValue);
const metadata = JSON.parse(metadataSource);
const metadataByScreenId = new Map(metadata.beats.map((beat) => [beat.screenId, beat]));

const exportBeats = beats.map((beat, index) => {
  const metadataBeat = beat.screenId ? metadataByScreenId.get(beat.screenId) : null;
  const opener = beat.props?.coachLine ?? metadataBeat?.opener ?? null;

  return {
    index: index + 1,
    screenId: beat.screenId ?? null,
    opener,
    path: beat.path ?? null,
  };
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      source: {
        beats: 'src/components/flow-designer/FlowDesigner.tsx#BEATS',
        metadata: 'src/components/flow-designer/onboardingMetadata.json',
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

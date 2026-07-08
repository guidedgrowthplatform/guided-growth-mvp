// Guard 1 of 2: CONSISTENCY.
// The onboarding render reads exactly ONE authored store: beatsSource.ts. This
// check asserts (a) that single source is the only hand-authored metadata store
// (onboardingMetadata.json is retired, and beatsSource is what the render reads),
// and (b) every beat entry carries the required fields and a well-formed script.
// Pair with render-link-integrity-check.mjs.

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const flowDesignerPath = path.join(root, 'src/components/flow-designer/FlowDesigner.tsx');
const flowPlayPath = path.join(root, 'src/components/flow-designer/FlowPlay.tsx');
const retiredJsonPath = path.join(root, 'src/components/flow-designer/onboardingMetadata.json');

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : prop.name.getText();
      out[key] = literalValue(prop.initializer);
    }
    return out;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  throw new Error(`Unsupported literal: ${ts.SyntaxKind[node.kind]}`);
}

function parseBeatsSource(text) {
  const sf = ts.createSourceFile('beatsSource.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let arr = null;
  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'BEATS_SOURCE' &&
      node.initializer
    ) {
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isArrayLiteralExpression(init)) arr = init;
      return;
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (!arr) throw new Error('Could not find BEATS_SOURCE in beatsSource.ts');
  return arr.elements.map(literalValue);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const problems = [];

// (a) exactly one source: the retired json must be gone, and the render files
// must read beatsSource, not the old json.
if (await exists(retiredJsonPath)) {
  problems.push('onboardingMetadata.json still exists: retire it, the one source is beatsSource.ts');
}
for (const [name, p] of [
  ['FlowDesigner.tsx', flowDesignerPath],
  ['FlowPlay.tsx', flowPlayPath],
]) {
  const src = await readFile(p, 'utf8');
  if (src.includes('onboardingMetadata')) {
    problems.push(`${name} still references onboardingMetadata (should read beatsSource.ts)`);
  }
}

// (b) required fields per entry + well-formed script.
const REQUIRED = ['id', 'name', 'order', 'path', 'type', 'voiceEngine'];
const PATHS = new Set(['beginner', 'advanced', 'both']);
const KINDS = new Set(['bubble', 'component']);
const beats = parseBeatsSource(await readFile(beatsSourcePath, 'utf8'));

const seenIds = new Set();
const orders = [];
for (const beat of beats) {
  const label = beat.id ?? beat.screenId ?? '(unknown)';
  for (const field of REQUIRED) {
    if (beat[field] === undefined || beat[field] === null || beat[field] === '') {
      problems.push(`${label}: missing required field "${field}"`);
    }
  }
  if (beat.id) {
    if (seenIds.has(beat.id)) problems.push(`${label}: duplicate id`);
    seenIds.add(beat.id);
  }
  if (beat.path && !PATHS.has(beat.path)) problems.push(`${label}: invalid path "${beat.path}"`);
  if (typeof beat.order === 'number') orders.push(beat.order);
  if (!Array.isArray(beat.script)) {
    problems.push(`${label}: script is not an array`);
    continue;
  }
  let expectedSeq = 1;
  for (const line of beat.script) {
    if (line.seq !== expectedSeq) {
      problems.push(`${label}: script seq out of order (expected ${expectedSeq}, got ${line.seq})`);
    }
    expectedSeq += 1;
    if (!line.bindsTo || !KINDS.has(line.bindsTo.kind)) {
      problems.push(`${label}: script line ${line.seq} has invalid bindsTo.kind`);
    }
    if (!line.bindsTo?.element) {
      problems.push(`${label}: script line ${line.seq} missing bindsTo.element`);
    }
    if (!line.bindsTo?.screen) {
      problems.push(`${label}: script line ${line.seq} missing bindsTo.screen`);
    }
  }
}

// order must be a dense 0..n-1 sequence (one ordered source).
const sortedOrders = [...orders].sort((a, b) => a - b);
for (let i = 0; i < sortedOrders.length; i++) {
  if (sortedOrders[i] !== i) {
    problems.push(`order is not a dense 0..${sortedOrders.length - 1} sequence (found ${sortedOrders.join(',')})`);
    break;
  }
}

if (problems.length) {
  console.error('Render CONSISTENCY check failed.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(`Render CONSISTENCY check passed: ${beats.length} beats, one source (beatsSource.ts).`);

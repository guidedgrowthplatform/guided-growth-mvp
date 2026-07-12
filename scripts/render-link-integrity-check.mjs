// Guard 2 of 2: LINK INTEGRITY.
// Every script line must point at something real:
//   1. bindsTo.element must resolve within that beat entry's own element
//      vocabulary. A component line that names a declared elementId (e.g. "age",
//      "sleep", "createOwn") must have that id in the beat's declared elements;
//      structural tokens the script itself owns (bubble-N, opener, reveal-N,
//      close-bubble, second-bubble, confirm-bubble, opener-line) are valid.
//      A line pointing at an element the beat does not declare fails.
//   2. every clip id must resolve to a real file under public/voice (the /voice/ob
//      clips plus the splash welcome). A line with a clip that has no file fails.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const voiceObDir = path.join(root, 'public/voice/ob');
const voiceDir = path.join(root, 'public/voice');

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
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'BEATS_SOURCE' && node.initializer) {
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isArrayLiteralExpression(init)) arr = init;
      return;
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (!arr) throw new Error('Could not find BEATS_SOURCE in beatsSource.ts');
  return arr.elements.map(literalValue);
}

// Structural element tokens the script owns for itself (not per-component ids).
const STRUCTURAL = /^(opener|opener-line|second-bubble|close-bubble|confirm-bubble|bubble-\d+|reveal-\d+)$/;

const beats = parseBeatsSource(await readFile(beatsSourcePath, 'utf8'));

const obFiles = new Set(await readdir(voiceObDir));
const rootFiles = new Set((await readdir(voiceDir)).filter((f) => /\.(mp3|wav)$/.test(f)));
function clipResolves(clipPath, clipId) {
  if (clipPath) {
    const rel = clipPath.replace(/^\/voice\//, '');
    if (rel.startsWith('ob/')) return obFiles.has(rel.slice(3));
    return rootFiles.has(rel);
  }
  // no explicit path: try /voice/ob/<id>.wav
  return obFiles.has(`${clipId}.wav`);
}

const problems = [];

for (const beat of beats) {
  const label = beat.id ?? beat.screenId ?? '(unknown)';
  const declaredElementIds = new Set(beat.elements ?? []);

  for (const line of beat.script ?? []) {
    const el = line.bindsTo?.element ?? '';
    // element resolution
    if (line.bindsTo?.kind === 'component' && !STRUCTURAL.test(el)) {
      // a named component element must be a declared element of this beat
      if (!declaredElementIds.has(el)) {
        problems.push(`${label}: script line ${line.seq} binds to component element "${el}" not declared in this beat`);
      }
    } else if (line.bindsTo?.kind === 'bubble' && !STRUCTURAL.test(el)) {
      problems.push(`${label}: script line ${line.seq} bubble element "${el}" is not a valid structural token`);
    }
    // clip resolution
    if (line.clip) {
      if (!clipResolves(line.clipPath, line.clip)) {
        problems.push(`${label}: script line ${line.seq} clip "${line.clip}" (${line.clipPath ?? 'no path'}) has no file under public/voice`);
      }
    }
  }
}

if (problems.length) {
  console.error('Render LINK-INTEGRITY check failed.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(`Render LINK-INTEGRITY check passed: ${beats.length} beats, all bindsTo elements + clips resolve.`);

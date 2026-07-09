// Shared reader for the render guard family (id-alias / persistence / decisions).
// Same AST-literal parse as render-consistency-check.mjs; kept separate so the
// two original guards stay standalone.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const BEATS_SOURCE_REL = 'src/components/flow-designer/beatsSource.ts';

export function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
    return -Number(node.operand.text);
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key =
        ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : prop.name.getText();
      out[key] = literalValue(prop.initializer);
    }
    return out;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  return undefined;
}

export async function loadBeatsSource(sourcePath) {
  const resolved = sourcePath ?? path.join(process.cwd(), BEATS_SOURCE_REL);
  const text = await readFile(resolved, 'utf8');
  const sf = ts.createSourceFile(
    'beatsSource.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let arr = null;
  const exportedNames = new Set();
  (function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      exportedNames.add(node.name.text);
      if (node.name.text === 'BEATS_SOURCE' && node.initializer) {
        const init = ts.isAsExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        if (ts.isArrayLiteralExpression(init)) arr = init;
      }
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (!arr) throw new Error(`Could not find BEATS_SOURCE in ${resolved}`);
  return { beats: arr.elements.map(literalValue), exportedNames, text, path: resolved };
}

// Uniform verdict: problems always fail; gaps are the not-yet-filled Bible
// sections (the fill is a held track) and fail only under
// RENDER_GUARDS_STRICT=1 — the step-5 flip sets that alongside allow_failure.
export function report(name, { problems = [], gaps = [], notes = [], passMsg = '' }) {
  const strict = process.env.RENDER_GUARDS_STRICT === '1';
  if (notes.length) {
    console.log(`${name} notes:`);
    for (const n of notes) console.log(`  - ${n}`);
    console.log('');
  }
  if (gaps.length) {
    console.log(`${name} coverage gaps (${gaps.length})${strict ? ' [STRICT: fatal]' : ''}:`);
    for (const g of gaps) console.log(`  - ${g}`);
    console.log('');
  }
  if (problems.length) {
    console.error(`${name} FAILED.\n`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  if (strict && gaps.length) {
    console.error(`${name} FAILED: ${gaps.length} coverage gap(s) under RENDER_GUARDS_STRICT.`);
    process.exit(1);
  }
  console.log(`${name} passed: ${passMsg}`);
}

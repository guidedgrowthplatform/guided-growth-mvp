// Shared AST-parsing helpers for the per-registry-id static checks under
// scripts/checks/. Mirrors the TypeScript-compiler-API approach already used by
// scripts/render-consistency-check.mjs and scripts/bible-registry-check.mjs, so
// every guard reads the SAME literal source beat entries the render itself
// consumes (no separate hand-authored copy of the data can drift).
//
// Deliberately read-only: nothing here mutates flowBible.ts or beatsSource.ts.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const ROOT = process.cwd();
export const FLOWBIBLE_PATH = path.join(ROOT, 'src/components/flow-designer/flowBible.ts');
export const BEATSSOURCE_PATH = path.join(ROOT, 'src/components/flow-designer/beatsSource.ts');

// --- literal AST node -> plain JS value (same shape as bible-registry-check.mjs) ---

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
  throw new Error(`Unsupported literal: ${ts.SyntaxKind[node.kind]}`);
}

export function findExportedArray(sourceFile, name) {
  let arr = null;
  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isArrayLiteralExpression(init)) arr = init;
      return;
    }
    ts.forEachChild(node, visit);
  })(sourceFile);
  if (!arr) throw new Error(`Could not find ${name}`);
  return arr;
}

export async function loadSourceFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  return ts.createSourceFile(path.basename(filePath), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

export function lineOf(sourceFile, node) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return line + 1;
}

// Every element of BEATS_SOURCE, as { beatId, node (AST, for line numbers),
// value (plain JS, full literal beat entry incl. any authored `bible`) }.
export async function loadBeats() {
  const sourceFile = await loadSourceFile(BEATSSOURCE_PATH);
  const arrayNode = findExportedArray(sourceFile, 'BEATS_SOURCE');
  const beats = [];
  for (const node of arrayNode.elements) {
    if (!ts.isObjectLiteralExpression(node)) continue;
    const value = literalValue(node);
    beats.push({ beatId: value.id, node, value, line: lineOf(sourceFile, node) });
  }
  return { sourceFile, beats };
}

// Beats that literally author their OWN `bible` object in beatsSource.ts (as
// opposed to a `variantOf` sub-beat resolving one at runtime via
// resolveBeatStructure). Every check in this directory reasons over what is
// actually authored on disk, same as bible-registry-check.mjs.
export function ownBibleBeats(beats) {
  return beats.filter((b) => b.value.bible && typeof b.value.bible === 'object');
}

export async function loadEnforcerRegistry() {
  const sourceFile = await loadSourceFile(FLOWBIBLE_PATH);
  const arrayNode = findExportedArray(sourceFile, 'ENFORCER_REGISTRY');
  return arrayNode.elements.map(literalValue);
}

// Standard pass/fail reporting so every check script prints + exits the same way.
export function report(problems, passMessage) {
  if (problems.length) {
    console.error(`FAILED: ${problems.length} violation(s) found.\n`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log(passMessage);
}

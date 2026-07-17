import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const root = process.cwd();
export const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key =
        ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)
          ? property.name.text
          : property.name.getText();
      value[key] = literalValue(property.initializer);
    }
    return value;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  throw new Error(`Unsupported literal: ${ts.SyntaxKind[node.kind]}`);
}

export async function readBeats() {
  const text = await readFile(beatsSourcePath, 'utf8');
  const sourceFile = ts.createSourceFile('beatsSource.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let entries = null;

  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'BEATS_SOURCE' &&
      node.initializer
    ) {
      const initializer = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isArrayLiteralExpression(initializer)) entries = initializer;
      return;
    }
    ts.forEachChild(node, visit);
  })(sourceFile);

  if (!entries) throw new Error('Could not find BEATS_SOURCE in beatsSource.ts');
  return entries.elements.map(literalValue);
}

export function ruleEntries(beat) {
  const groups = ['rulesContext', 'rulesCode'];
  return groups.flatMap((group) => {
    const value = beat.bible?.[group];
    return Array.isArray(value) ? value : value?.rows ?? [];
  });
}

export function fail({ id, ruleId, beatId, seq = 'n/a', expected, actual }) {
  return `id=${id}; rule_id=${ruleId}; beat_id=${beatId}; seq=${seq}; expected=${expected}; actual=${actual}`;
}

export function isExplicitNone(value) {
  return /^none\b/i.test(String(value).trim());
}

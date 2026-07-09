// Guard 3: RULES SELF-AUDIT (per gg-spec/docs/annotated-render-spec.md).
// A rule is only a guardrail if you can see how it is enforced. This check reads
// every beat's annotation.rules and asserts the rules model polices itself:
//   1. every rule is well-formed (id, rule text, valid severity, enforcedBy present),
//      and ids are unique within a beat.
//   2. a CODE rule's enforcedBy, when non-null, names a REAL enforcer (a check
//      script that exists, or a known runner like type-check). A typo'd or invented
//      enforcer fails the build. That is "no rule claims enforcement it does not have."
//   3. a `must` rule with a null enforcer must be explicitly marked
//      proseOnlyAccepted. That is "no unenforced must-rule slips in silently."
// Beats without an annotation are skipped (annotation is incremental). Pairs with
// render-consistency-check.mjs and render-link-integrity-check.mjs.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const scriptsDir = path.join(root, 'scripts');

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
      const key =
        ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : prop.name.getText();
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

// The set of enforcers that actually exist. A code rule may only claim one of
// these. Built from the real check scripts plus known runners.
const KNOWN_ENFORCERS = new Set(['type-check', 'tsc']);
for (const f of await readdir(scriptsDir)) {
  if (f.endsWith('.mjs')) KNOWN_ENFORCERS.add(f.replace(/\.mjs$/, ''));
}
// Soft enforcers for context (coach-behavior) rules: the behavioral parity walk,
// not a code guard. Named so a typo still fails, but they need not be a script.
const SOFT_ENFORCERS = new Set(['parity-walk', 'behavioral-parity-walk']);

const SEVERITIES = new Set(['must', 'should']);

const problems = [];
let annotatedBeats = 0;
let ruleCount = 0;
let proseOnlyMust = 0;
let needsYair = 0;

const beats = parseBeatsSource(await readFile(beatsSourcePath, 'utf8'));

function checkColumn(label, column, rules, seenIds, allowSoft) {
  if (!Array.isArray(rules)) {
    problems.push(`${label}: rules.${column} is not an array`);
    return;
  }
  for (const r of rules) {
    ruleCount += 1;
    const rid = r && typeof r.id === 'string' ? r.id : '(no id)';
    const where = `${label} [${column}:${rid}]`;
    if (!r || typeof r !== 'object') {
      problems.push(`${where}: rule is not an object`);
      continue;
    }
    if (!r.id || typeof r.id !== 'string') problems.push(`${where}: missing or non-string id`);
    else if (seenIds.has(r.id)) problems.push(`${where}: duplicate rule id within beat`);
    else seenIds.add(r.id);
    if (!r.rule || typeof r.rule !== 'string') problems.push(`${where}: missing or empty rule text`);
    if (!SEVERITIES.has(r.severity)) problems.push(`${where}: invalid severity "${r.severity}" (must|should)`);
    if (r.enforcedBy !== null && typeof r.enforcedBy !== 'string') {
      problems.push(`${where}: enforcedBy must be a string or null`);
    }
    // Enforcer existence: a non-null enforcer must be real.
    if (typeof r.enforcedBy === 'string') {
      const ok = KNOWN_ENFORCERS.has(r.enforcedBy) || (allowSoft && SOFT_ENFORCERS.has(r.enforcedBy));
      if (!ok) {
        problems.push(
          `${where}: enforcedBy "${r.enforcedBy}" names an enforcer that does not exist ` +
            `(known: ${[...KNOWN_ENFORCERS].sort().join(', ')}${allowSoft ? `; soft: ${[...SOFT_ENFORCERS].join(', ')}` : ''})`,
        );
      }
    }
    // No unenforced must-rule slips in silently.
    if (r.severity === 'must' && r.enforcedBy === null && r.proseOnlyAccepted !== true) {
      problems.push(`${where}: severity "must" with null enforcedBy must be marked proseOnlyAccepted: true`);
    }
    if (r.severity === 'must' && r.enforcedBy === null && r.proseOnlyAccepted === true) proseOnlyMust += 1;
    if (r.needsYair === true) needsYair += 1;
  }
}

for (const beat of beats) {
  const ann = beat.annotation;
  if (!ann) continue;
  annotatedBeats += 1;
  const label = beat.id ?? '(unknown)';
  if (!ann.rules || typeof ann.rules !== 'object') {
    problems.push(`${label}: annotation present but annotation.rules missing`);
    continue;
  }
  const seenIds = new Set();
  checkColumn(label, 'context', ann.rules.context, seenIds, true);
  checkColumn(label, 'code', ann.rules.code, seenIds, false);
}

if (problems.length) {
  console.error('Render RULES self-audit failed.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  `Render RULES self-audit passed: ${annotatedBeats} annotated beat(s), ${ruleCount} rule(s), ` +
    `${proseOnlyMust} prose-only must-rule(s), ${needsYair} rule(s) flagged needs-Yair.`,
);

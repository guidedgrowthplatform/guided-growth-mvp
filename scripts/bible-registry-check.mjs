// Guard: REGISTRY CROSS-CHECK.
// Every `enforcedBy` string, wherever it appears (flowBible.ts itself, or a beat
// bible section/rule in beatsSource.ts), must resolve to a real id in
// ENFORCER_REGISTRY (flowBible.ts). A rule that cites an id nobody registered is
// unenforceable and unverifiable — the whole point of the registry (open decision
// "registry-staging") is that PLANNED ids are legal only if listed with an owner.
//
// Also validates the uniform-sections rule (open decision "uniform-sections",
// Yair/conductor 2026-07-09, LOCKED): every beat that carries a `bible` must
// declare a `sectionManifest` covering all 14 BibleSectionKey values, each
// 'filled' (section present + non-empty), { na: reason } (section may be
// absent, reason required), or 'pending-app-reconcile' (section may be absent).
//
// Mirrors the TypeScript-compiler-API parsing approach of render-consistency-check.mjs.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const flowBiblePath = path.join(root, 'src/components/flow-designer/flowBible.ts');
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');

// TODO(app-reconcile): per-archetype legality table for which sections a given
// beat `type` may legitimately mark { na } vs must fill. For now the guard only
// enforces manifest COMPLETENESS + shape, not per-type policy.
const SECTION_KEYS = [
  'identity',
  'scriptMeta',
  'components',
  'voice',
  'rulesContext',
  'rulesCode',
  'conversation',
  'contextProse',
  'allowedTools',
  'persistence',
  'flow',
  'edges',
  'acceptance',
  'applicableDecisions',
];

// --- Shared literal->JS conversion (same approach as render-consistency-check.mjs) ---

function literalValue(node) {
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

function findExportedArray(sourceFile, name) {
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

// Collect every `enforcedBy: <expr>` PropertyAssignment under `root`, tagged with
// a caller-supplied label and its source line (1-based). Does not descend into
// the enforcedBy value itself (it has no nested enforcedBy).
function collectEnforcedBy(root, sourceFile, label) {
  const found = [];
  (function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'enforcedBy') {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      found.push({ initializer: node.initializer, line: line + 1, label });
      return;
    }
    ts.forEachChild(node, visit);
  })(root);
  return found;
}

function validateEnforcedByEntries(entries, registryIds, problems) {
  for (const { initializer, line, label } of entries) {
    if (!ts.isArrayLiteralExpression(initializer)) {
      problems.push(`${label} (line ${line}): enforcedBy is not an array (must be readonly string[])`);
      continue;
    }
    for (const el of initializer.elements) {
      if (!ts.isStringLiteral(el)) {
        problems.push(`${label} (line ${line}): enforcedBy element is not a string literal`);
        continue;
      }
      if (!registryIds.has(el.text)) {
        problems.push(`${label} (line ${line}): enforcedBy references unknown id "${el.text}" (not in ENFORCER_REGISTRY)`);
      }
    }
  }
}

// --- sectionManifest fill-status checks (JS-value side, beat id + key only) ---

function isNAStatus(v) {
  return v !== null && typeof v === 'object' && typeof v.na === 'string';
}

function sectionNonEmpty(key, bible) {
  const section = bible[key];
  if (key === 'rulesContext' || key === 'rulesCode') {
    // top-level array sections (no section object wrapper)
    return Array.isArray(bible[key]) ? bible[key].length > 0 : false;
  }
  if (!section || typeof section !== 'object') return false;
  switch (key) {
    case 'identity':
      return (section.rows?.length ?? 0) > 0 && (section.aliases?.length ?? 0) > 0;
    case 'conversation':
      return Boolean(section.opens) && (section.branches?.length ?? 0) > 0;
    case 'contextProse':
      return typeof section.prose === 'string' && section.prose.length > 0;
    case 'allowedTools':
      return (section.tools?.length ?? 0) > 0;
    default:
      // scriptMeta, components, voice, persistence, flow, edges, acceptance, applicableDecisions
      return (section.rows?.length ?? 0) > 0;
  }
}

function validateSectionManifest(beatId, bible, problems) {
  const manifest = bible.sectionManifest;
  if (!manifest || typeof manifest !== 'object') {
    problems.push(`${beatId}: bible is missing sectionManifest (required, all ${SECTION_KEYS.length} keys)`);
    return;
  }
  for (const key of SECTION_KEYS) {
    if (!(key in manifest)) {
      problems.push(`${beatId}: sectionManifest missing key "${key}"`);
      continue;
    }
    const status = manifest[key];
    if (status === 'filled') {
      if (!sectionNonEmpty(key, bible)) {
        problems.push(`${beatId}: sectionManifest.${key} is "filled" but bible.${key} is absent/empty`);
      }
      continue;
    }
    if (status === 'pending-app-reconcile') {
      continue; // section may legitimately be absent
    }
    if (isNAStatus(status)) {
      if (!status.na.trim()) {
        problems.push(`${beatId}: sectionManifest.${key} is { na } with an empty reason`);
      }
      continue;
    }
    problems.push(
      `${beatId}: sectionManifest.${key} has an invalid value (must be 'filled', 'pending-app-reconcile', or { na: string })`,
    );
  }
}

// --- main ---

const problems = [];

const flowBibleText = await readFile(flowBiblePath, 'utf8');
const flowBibleSf = ts.createSourceFile(
  'flowBible.ts',
  flowBibleText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const registryArrayNode = findExportedArray(flowBibleSf, 'ENFORCER_REGISTRY');
const registryEntries = registryArrayNode.elements.map(literalValue);
const registryIds = new Set(registryEntries.map((e) => e.id));
if (registryIds.size !== registryEntries.length) {
  problems.push('ENFORCER_REGISTRY has duplicate ids');
}

// flowBible.ts self-check: every enforcedBy array it authors must also resolve.
const flowBibleEnforcedBy = collectEnforcedBy(flowBibleSf, flowBibleSf, 'flowBible.ts');
validateEnforcedByEntries(flowBibleEnforcedBy, registryIds, problems);

const beatsSourceText = await readFile(beatsSourcePath, 'utf8');
const beatsSf = ts.createSourceFile(
  'beatsSource.ts',
  beatsSourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const beatsArrayNode = findExportedArray(beatsSf, 'BEATS_SOURCE');

let beatsWithBible = 0;
let beatsEnforcedByCount = 0;

for (const beatNode of beatsArrayNode.elements) {
  if (!ts.isObjectLiteralExpression(beatNode)) continue;
  const idProp = beatNode.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'id',
  );
  const beatId =
    idProp && ts.isPropertyAssignment(idProp) && ts.isStringLiteral(idProp.initializer)
      ? idProp.initializer.text
      : '(unknown beat)';

  const bibleProp = beatNode.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'bible',
  );
  if (!bibleProp || !ts.isPropertyAssignment(bibleProp) || !ts.isObjectLiteralExpression(bibleProp.initializer)) {
    continue; // no bible fill on this beat: nothing to cross-check
  }
  beatsWithBible += 1;

  const entries = collectEnforcedBy(bibleProp.initializer, beatsSf, beatId);
  beatsEnforcedByCount += entries.length;
  validateEnforcedByEntries(entries, registryIds, problems);

  const bibleValue = literalValue(bibleProp.initializer);
  validateSectionManifest(beatId, bibleValue, problems);
}

if (problems.length) {
  console.error('Bible REGISTRY cross-check failed.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  `Bible REGISTRY cross-check passed: ${registryIds.size} registry ids, ` +
    `${flowBibleEnforcedBy.length} enforcedBy refs in flowBible.ts, ` +
    `${beatsWithBible} beat(s) with a bible fill, ${beatsEnforcedByCount} enforcedBy refs in beatsSource.ts, ` +
    `all resolved; sectionManifest validated (${SECTION_KEYS.length} keys) on every bible-bearing beat.`,
);

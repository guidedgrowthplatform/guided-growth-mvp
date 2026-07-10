// Guard: REGISTRY CROSS-CHECK + COVERAGE + VARIANT-INHERITANCE LEAK + MODES.
//
// 1) REGISTRY cross-check (static): every `enforcedBy` string, wherever it appears
//    (flowBible.ts itself, or a beat bible section/rule in beatsSource.ts), must
//    resolve to a real id in ENFORCER_REGISTRY (flowBible.ts). A rule that cites an
//    id nobody registered is unenforceable.
//
// 2) COVERAGE (open decision "uniform-sections", Yair/conductor 2026-07-09, LOCKED):
//    EVERY onboarding beat must resolve a manifest, and every one of the 14
//    BibleSectionKey sections must be owner-filled, explicitly derived, { na: reason },
//    or pending-app-reconcile. No beat is silently skipped. A beat with no bible and
//    no variantOf resolves to an all-pending manifest (honest: not yet contracted).
//
// 3) VARIANT-INHERITANCE LEAK (B1, the scale gate): a variantOf beat's RESOLVED
//    bible must not contain the head's category label, the head's clip ids, the
//    head's rule-id prefix, the head's beatId, or the head's screenId in any
//    DERIVED section; and it may not claim 'filled' for a section it does not own.
//    This runs against the resolver's ACTUAL output (scripts/dump-resolved-beats.mts
//    via tsx), so a resolver that regresses to shallow-copying fails here.
//
// 4) MODES: authoring (default) vs release/scale. Authoring allows PLANNED enforcer
//    ids (registry-staging). Release requires every MUST rule's enforcedBy to resolve
//    to a BUILT static checker or a runnable fleet eval. Select with --mode=release.
//
// Mirrors the TypeScript-compiler-API parsing approach of render-consistency-check.mjs.

import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const flowBiblePath = path.join(root, 'src/components/flow-designer/flowBible.ts');
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const dumpScript = path.join('scripts', 'dump-resolved-beats.mts');

const MODE = process.argv.includes('--mode=release') ? 'release' : 'authoring';

// The 14 uniform section keys (mirrors BibleSectionKey / beatsSource BIBLE_SECTION_KEYS).
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
      const init = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (ts.isArrayLiteralExpression(init)) arr = init;
      return;
    }
    ts.forEachChild(node, visit);
  })(sourceFile);
  if (!arr) throw new Error(`Could not find ${name}`);
  return arr;
}

// Collect every `enforcedBy: <expr>` PropertyAssignment under `root`, tagged with
// a caller-supplied label and its source line (1-based).
function collectEnforcedBy(rootNode, sourceFile, label) {
  const found = [];
  (function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'enforcedBy'
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      found.push({ initializer: node.initializer, line: line + 1, label });
      return;
    }
    ts.forEachChild(node, visit);
  })(rootNode);
  return found;
}

function validateEnforcedByEntries(entries, registryIds, problems) {
  for (const { initializer, line, label } of entries) {
    if (!ts.isArrayLiteralExpression(initializer)) {
      problems.push(
        `${label} (line ${line}): enforcedBy is not an array (must be readonly string[])`,
      );
      continue;
    }
    for (const el of initializer.elements) {
      if (!ts.isStringLiteral(el)) {
        problems.push(`${label} (line ${line}): enforcedBy element is not a string literal`);
        continue;
      }
      if (!registryIds.has(el.text)) {
        problems.push(
          `${label} (line ${line}): enforcedBy references unknown id "${el.text}" (not in ENFORCER_REGISTRY)`,
        );
      }
    }
  }
}

// Collect MUST rules (release mode): every object literal that carries both a
// `severity: 'must'` and an `enforcedBy` array, tagged with its rule id + line.
function collectMustRules(rootNode, sourceFile, label) {
  const found = [];
  (function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      let severity;
      let enforcedBy;
      let id;
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
        if (prop.name.text === 'severity' && ts.isStringLiteral(prop.initializer))
          severity = prop.initializer.text;
        if (prop.name.text === 'id' && ts.isStringLiteral(prop.initializer))
          id = prop.initializer.text;
        if (prop.name.text === 'enforcedBy' && ts.isArrayLiteralExpression(prop.initializer))
          enforcedBy = prop.initializer.elements
            .filter((e) => ts.isStringLiteral(e))
            .map((e) => e.text);
      }
      if (severity === 'must' && enforcedBy) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        found.push({ id: id ?? '(unnamed rule)', enforcedBy, line: line + 1, label });
      }
    }
    ts.forEachChild(node, visit);
  })(rootNode);
  return found;
}

// --- sectionManifest fill-status checks (run on RESOLVED bible objects) ---

function isNAStatus(v) {
  return v !== null && typeof v === 'object' && typeof v.na === 'string';
}

function sectionNonEmpty(key, bible) {
  if (key === 'rulesContext' || key === 'rulesCode') {
    return Array.isArray(bible[key]) ? bible[key].length > 0 : false;
  }
  const section = bible[key];
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
      return (section.rows?.length ?? 0) > 0;
  }
}

// Validate a static AUTHORED manifest (heads + own-bible variants). Kept for line
// context and to fail an authored 'filled' claim on an empty/absent section.
function validateAuthoredManifest(beatId, bible, problems) {
  const manifest = bible.sectionManifest;
  if (!manifest || typeof manifest !== 'object') {
    problems.push(
      `${beatId}: bible is missing sectionManifest (required, all ${SECTION_KEYS.length} keys)`,
    );
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
        problems.push(
          `${beatId}: sectionManifest.${key} is "filled" but bible.${key} is absent/empty`,
        );
      }
      continue;
    }
    if (status === 'derived' || status === 'pending-app-reconcile') continue;
    if (isNAStatus(status)) {
      if (!status.na.trim()) {
        problems.push(`${beatId}: sectionManifest.${key} is { na } with an empty reason`);
      }
      continue;
    }
    problems.push(
      `${beatId}: sectionManifest.${key} has an invalid value (must be 'filled', 'derived', 'pending-app-reconcile', or { na: string })`,
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
const registryById = new Map(registryEntries.map((e) => [e.id, e]));
if (registryIds.size !== registryEntries.length) {
  problems.push('ENFORCER_REGISTRY has duplicate ids');
}

// (1) enforcedBy cross-check — flowBible self + every beat bible
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
  if (
    !bibleProp ||
    !ts.isPropertyAssignment(bibleProp) ||
    !ts.isObjectLiteralExpression(bibleProp.initializer)
  ) {
    continue;
  }
  beatsWithBible += 1;
  const entries = collectEnforcedBy(bibleProp.initializer, beatsSf, beatId);
  beatsEnforcedByCount += entries.length;
  validateEnforcedByEntries(entries, registryIds, problems);
  validateAuthoredManifest(beatId, literalValue(bibleProp.initializer), problems);
}

// (2)+(3) COVERAGE + VARIANT-INHERITANCE LEAK over the resolver's ACTUAL output.
let resolvedBeats;
try {
  const raw = execFileSync('npx', ['tsx', dumpScript], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  resolvedBeats = JSON.parse(raw);
} catch (err) {
  console.error(
    'Bible registry check: failed to resolve beats via tsx (scripts/dump-resolved-beats.mts).',
  );
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
}

const coverage = { ownerFilled: 0, derivedVariant: 0, allPending: 0 };

// Head tokens that must NOT survive onto a variant's derived sections. Skip a
// rule-id prefix shorter than 3 chars (too generic to scan without false hits).
function leakTokens(headTokens) {
  if (!headTokens) return [];
  const tokens = new Set();
  if (headTokens.id) tokens.add(headTokens.id);
  if (headTokens.category) tokens.add(headTokens.category);
  if (headTokens.screenId) tokens.add(headTokens.screenId);
  if (typeof headTokens.rulePrefix === 'string' && headTokens.rulePrefix.length >= 3)
    tokens.add(headTokens.rulePrefix);
  for (const clip of headTokens.clips ?? []) if (clip) tokens.add(clip);
  return [...tokens];
}

for (const beat of resolvedBeats) {
  const manifest = beat.resolvedManifest;
  const bible = beat.resolvedBible;
  const isVariant = Boolean(beat.variantOf);
  const owns = new Set(beat.ownBibleKeys);

  // Safety net: the resolver now emits a real 14-key manifest for every beat, so a
  // null here would mean a resolver regression, not a no-bible beat.
  if (!manifest) {
    coverage.allPending += 1;
    continue;
  }
  // Classify by the REAL manifest content (not by bible presence): every-key-pending
  // = all-pending; else variant = derived, else owner-filled.
  const allPending = SECTION_KEYS.every((k) => manifest[k] === 'pending-app-reconcile');
  if (allPending) coverage.allPending += 1;
  else if (isVariant) coverage.derivedVariant += 1;
  else coverage.ownerFilled += 1;

  for (const key of SECTION_KEYS) {
    if (!(key in manifest)) {
      problems.push(`${beat.id}: resolved manifest missing key "${key}"`);
      continue;
    }
    const status = manifest[key];
    if (status === 'filled') {
      if (!owns.has(key)) {
        problems.push(
          `${beat.id}: manifest.${key} claims 'filled' but the beat does not own that section (a variant may only inherit as 'derived', never claim authorship)`,
        );
      } else if (!bible || !sectionNonEmpty(key, bible)) {
        problems.push(
          `${beat.id}: manifest.${key} is 'filled' but the resolved section is absent/empty`,
        );
      }
      continue;
    }
    if (status === 'derived') {
      if (!isVariant) {
        problems.push(
          `${beat.id}: manifest.${key} is 'derived' but the beat is not a variant (only variantOf beats derive)`,
        );
      } else if (!bible || !sectionNonEmpty(key, bible)) {
        problems.push(
          `${beat.id}: manifest.${key} is 'derived' but the resolver produced no content for it`,
        );
      }
      continue;
    }
    if (status === 'pending-app-reconcile') continue;
    if (isNAStatus(status)) {
      if (!String(status.na).trim())
        problems.push(`${beat.id}: manifest.${key} is { na } with an empty reason`);
      continue;
    }
    problems.push(
      `${beat.id}: manifest.${key} has an invalid value (must be 'filled', 'derived', 'pending-app-reconcile', or { na: string })`,
    );
  }

  // LEAK scan: over the sections the variant DERIVED (not authored). No head
  // token may survive there.
  if (isVariant && bible) {
    const tokens = leakTokens(beat.headTokens);
    for (const key of beat.derivedSections ?? []) {
      const sectionStr = JSON.stringify(bible[key] ?? null);
      for (const tok of tokens) {
        if (sectionStr.includes(tok)) {
          problems.push(
            `${beat.id}: derived section '${key}' leaks head token "${tok}" from ${beat.variantOf} (variant content must be per-variant, not the head's)`,
          );
        }
      }
    }
  }
}

// (4) RELEASE MODE: every MUST rule's enforcedBy must be a BUILT static checker or
// a runnable fleet eval. Authoring mode allows planned ids (registry-staging).
function enforceableInRelease(id) {
  const e = registryById.get(id);
  if (!e) return false; // unknown ids already flagged by the cross-check
  if (e.status !== 'built') return false;
  if (e.kind === 'static') return true;
  return e.runnable === true; // a qa-eval must be configured + runnable
}

if (MODE === 'release') {
  const mustRules = [
    ...collectMustRules(flowBibleSf, flowBibleSf, 'flowBible.ts'),
    ...collectMustRules(beatsArrayNode, beatsSf, 'beatsSource.ts'),
  ];
  for (const { id, enforcedBy, line, label } of mustRules) {
    for (const enfId of enforcedBy) {
      if (!enforceableInRelease(enfId)) {
        const e = registryById.get(enfId);
        const why = !e
          ? 'unknown id'
          : e.status !== 'built'
            ? `status=${e.status}`
            : `qa-eval not runnable`;
        problems.push(
          `RELEASE: must-rule "${id}" (${label} line ${line}) cites enforcer "${enfId}" that is not release-ready (${why})`,
        );
      }
    }
  }
}

if (problems.length) {
  console.error(`Bible registry check FAILED (mode=${MODE}).\n`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  `Bible registry check passed (mode=${MODE}): ${registryIds.size} registry ids, ` +
    `${flowBibleEnforcedBy.length} enforcedBy refs in flowBible.ts, ` +
    `${beatsWithBible} authored bible(s), ${beatsEnforcedByCount} enforcedBy refs in beatsSource.ts, all resolved. ` +
    `Coverage: ${resolvedBeats.length} beats resolved a manifest ` +
    `(${coverage.ownerFilled} owner-filled, ${coverage.derivedVariant} derived-variant, ${coverage.allPending} all-pending), ` +
    `no variant leaked a head token, no non-owned 'filled' claim.` +
    (MODE === 'authoring'
      ? ' (Release mode --mode=release additionally requires every must-rule enforcer to be built/runnable.)'
      : ''),
);

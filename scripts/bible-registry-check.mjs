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
// Also runs the VARIANT CONTENT LEAK-CHECK (re-QA B1): every variantOf beat is
// resolved the way resolveBeatStructure resolves it (parameterized substitution,
// replicated below because the source is TS), then every resolved string is
// scanned for head-only facts — the head's props.category value and any head
// script clip id/path the variant replaces. A hit FAILS the check. This is what
// makes a head fact leaking into a sibling card impossible at the x36 fill.
//
// Mirrors the TypeScript-compiler-API parsing approach of render-consistency-check.mjs.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const flowBiblePath = path.join(root, 'src/components/flow-designer/flowBible.ts');
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const goalsModulePath = path.join(root, 'packages/shared/dist/data/onboardingGoals.js');

// TODO(fill-lane): per-archetype section-legality table (which sections may be N-A per beat type)
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
// a caller-supplied label and its source line (1-based). Does not descend into
// the enforcedBy value itself (it has no nested enforcedBy).
function collectEnforcedBy(root, sourceFile, label) {
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
  })(root);
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

function propInitializer(objNode, name) {
  const prop = objNode.properties.find(
    (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name,
  );
  return prop && ts.isPropertyAssignment(prop) ? prop.initializer : undefined;
}

let beatsWithBible = 0;
let beatsEnforcedByCount = 0;
const beats = [];

for (const beatNode of beatsArrayNode.elements) {
  if (!ts.isObjectLiteralExpression(beatNode)) continue;
  const idInit = propInitializer(beatNode, 'id');
  const beatId = idInit && ts.isStringLiteral(idInit) ? idInit.text : '(unknown beat)';

  const beat = {
    id: beatId,
    variantOf: undefined,
    screenId: null,
    props: null,
    script: [],
    bible: null,
  };
  for (const field of ['variantOf', 'screenId', 'props', 'script']) {
    const init = propInitializer(beatNode, field);
    if (init) beat[field] = literalValue(init);
  }
  beats.push(beat);

  const bibleInit = propInitializer(beatNode, 'bible');
  if (!bibleInit || !ts.isObjectLiteralExpression(bibleInit)) {
    continue; // no bible fill on this beat: nothing to cross-check
  }
  beatsWithBible += 1;

  const entries = collectEnforcedBy(bibleInit, beatsSf, beatId);
  beatsEnforcedByCount += entries.length;
  validateEnforcedByEntries(entries, registryIds, problems);

  beat.bible = literalValue(bibleInit);
  validateSectionManifest(beatId, beat.bible, problems);
}

// --- Variant content leak-check (replica of beatsSource.ts resolveBeatStructure
// parameterization; keep the two in lockstep) ---

let goalsByCategory = {};
try {
  ({ goalsByCategory } = await import(pathToFileURL(goalsModulePath).href));
} catch {
  problems.push(
    `leak-check: cannot import ${path.relative(root, goalsModulePath)} (run \`npm run build:shared\`)`,
  );
}

function ruleIdToken(beatId) {
  const dash = beatId.indexOf('-');
  if (dash < 0) return null;
  return beatId[0] + beatId.slice(dash + 1);
}

function buildSubstitutions(head, variant) {
  const subs = [];
  for (const headLine of head.script ?? []) {
    if (!headLine.clip) continue;
    const matched =
      (variant.script ?? []).find((l) => l.seq === headLine.seq) ?? (variant.script ?? [])[0];
    if (matched?.clip && matched.clip !== headLine.clip) {
      subs.push({ from: headLine.clip, to: matched.clip });
    }
    if (headLine.clipPath && matched?.clipPath && matched.clipPath !== headLine.clipPath) {
      subs.push({ from: headLine.clipPath, to: matched.clipPath });
    }
  }
  const headCategory = head.props?.category;
  const variantCategory = variant.props?.category;
  if (headCategory && variantCategory && headCategory !== variantCategory) {
    subs.push({ from: headCategory, to: variantCategory });
  }
  const headToken = ruleIdToken(head.id);
  const variantToken = ruleIdToken(variant.id);
  if (headToken && variantToken && headToken !== variantToken) {
    subs.push({ from: `${headToken}-`, to: `${variantToken}-` });
  }
  if (head.screenId && variant.screenId && head.screenId !== variant.screenId) {
    subs.push({ from: head.screenId, to: variant.screenId });
  }
  if (head.id !== variant.id) {
    subs.push({ from: head.id, to: variant.id });
  }
  return subs;
}

function applySubstitutions(value, subs) {
  let out = value;
  for (const { from, to } of subs) {
    if (from) out = out.split(from).join(to);
  }
  return out;
}

function parameterizeValue(value, subs) {
  if (typeof value === 'string') return applySubstitutions(value, subs);
  if (Array.isArray(value)) return value.map((v) => parameterizeValue(v, subs));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = parameterizeValue(v, subs);
    return out;
  }
  return value;
}

function parameterizeComponentsSection(components, variant, subs) {
  const category = variant.props?.category;
  const tiles = category ? goalsByCategory[category] : undefined;
  const rows = (components.rows ?? []).map((row) => {
    if (row.label !== 'on-screen tiles') return parameterizeValue(row, subs);
    if (tiles && tiles.length > 0) {
      return {
        label: row.label,
        value: `${tiles.length} subcategory tile${tiles.length === 1 ? '' : 's'}: ${tiles.join(', ')}, plus a "Create your own goal" tile`,
      };
    }
    const substituted = parameterizeValue(row, subs);
    return {
      ...substituted,
      pending: true,
      value: `${substituted.value} (derive tile labels at fill)`,
    };
  });
  return { ...parameterizeValue(components, subs), rows };
}

function resolveVariantBible(head, variant) {
  const own = variant.bible;
  const headBible = head.bible;
  if (!headBible && !own) return null;
  const merged = { ...headBible, ...own };
  if (headBible) {
    const subs = buildSubstitutions(head, variant);
    for (const key of Object.keys(headBible)) {
      if (key === 'identity' || key === 'sectionManifest') continue;
      if (own && key in own) continue;
      merged[key] =
        key === 'components'
          ? parameterizeComponentsSection(headBible[key], variant, subs)
          : parameterizeValue(headBible[key], subs);
    }
    if (!own?.sectionManifest) {
      merged.sectionManifest = parameterizeValue(headBible.sectionManifest, subs);
    }
  }
  delete merged.identity; // always derived from the variant's own fields, cannot leak
  return merged;
}

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

const beatById = new Map(beats.map((b) => [b.id, b]));
let variantsLeakChecked = 0;
let variantsWithInheritedContent = 0;

for (const variant of beats) {
  if (!variant.variantOf) continue;
  const head = beatById.get(variant.variantOf);
  if (!head) {
    problems.push(`${variant.id}: variantOf "${variant.variantOf}" does not resolve to a beat`);
    continue;
  }
  variantsLeakChecked += 1;

  // Leak tokens = head facts the substitution must have replaced: the head's
  // props.category and every head script clip id/path the variant replaces.
  const leakTokens = [];
  const headCategory = head.props?.category;
  if (headCategory && variant.props?.category && headCategory !== variant.props.category) {
    leakTokens.push(headCategory);
  }
  for (const headLine of head.script ?? []) {
    if (!headLine.clip) continue;
    const matched =
      (variant.script ?? []).find((l) => l.seq === headLine.seq) ?? (variant.script ?? [])[0];
    if (matched?.clip && matched.clip !== headLine.clip) leakTokens.push(headLine.clip);
    if (headLine.clipPath && matched?.clipPath && matched.clipPath !== headLine.clipPath) {
      leakTokens.push(headLine.clipPath);
    }
  }

  const resolved = resolveVariantBible(head, variant);
  if (!resolved) continue; // head has no bible fill yet: nothing inherited to leak
  if (head.bible) variantsWithInheritedContent += 1;
  if (leakTokens.length === 0) continue;

  const strings = collectStrings(resolved, []);
  for (const token of leakTokens) {
    const hit = strings.find((s) => s.includes(token));
    if (hit) {
      problems.push(
        `${variant.id}: resolved bible leaks head fact "${token}" from ${head.id} (in: "${hit.slice(0, 120)}")`,
      );
    }
  }
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
    `all resolved; sectionManifest validated (${SECTION_KEYS.length} keys) on every bible-bearing beat; ` +
    `variant leak-check: ${variantsLeakChecked} variantOf beat(s) checked ` +
    `(${variantsWithInheritedContent} with inherited bible content), 0 head-fact leaks.`,
);

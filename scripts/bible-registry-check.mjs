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

// Marker convention (beatsSource.ts): a section describing UI the render does NOT
// build yet tags its prose "ASSERTED SPEC ... does not implement yet". Release mode
// forbids such a section from also claiming manifest status 'filled'.
const ASSERTED_UNIMPLEMENTED_RE = /ASSERTED SPEC[\s\S]*?does not implement yet/i;

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
  // token may survive there. Two token classes:
  //  - exact tokens (category label, clip ids, rule prefix, beatId, screenId):
  //    case-sensitive substring.
  //  - SEMANTIC tokens (case-normalized category noun, clip-family root, beatId,
  //    category example label): case-insensitive. These are the tokens free-text
  //    substitution missed (B1-R). A resolver that reverts to substituting these
  //    inherited sections fails here.
  if (isVariant && bible) {
    const ht = beat.headTokens;
    // Namespace-prefix exemption (beatId only): a head beatId that is a strict PREFIX
    // of the variant's OWN beatId (e.g. head 'habits' vs variant
    // 'habits-fall-asleep-earlier') is dropped wholesale, because the bare head beatId
    // coincides with a common word ('habits') that legitimately appears in variant
    // prose ("at most two habits total"); the typed-rebuild path protects that family.
    // The head SCREENID is NOT dropped wholesale here — a wholesale drop hides a bare
    // head-screenId leak. It is instead masked at the OCCURRENCE level below (the
    // variant's own namespaced screenId is stripped from each section, then the bare
    // head screenId is scanned), so a variant's legitimate 'ONBOARD-BEGINNER-03--<GOAL>'
    // is suppressed while a BARE 'ONBOARD-BEGINNER-03' is still caught. Every other head
    // token (category, clip ids, rule prefix, rule ids) still scans by plain substring.
    // Goals is unaffected (its variant ids/screenIds do not extend the head's).
    const tokens = leakTokens(ht).filter((tok) => {
      if (
        ht &&
        tok === ht.id &&
        typeof beat.id === 'string' &&
        beat.id !== ht.id &&
        beat.id.startsWith(ht.id)
      )
        return false;
      return true;
    });
    const semanticTokens = (beat.headTokens?.semanticTokens ?? []).filter(
      (t) => typeof t === 'string' && t.length > 0,
    );
    // Head FULL rule ids (e.g. 'h-habit-cap'): only used when the head rule-prefix is
    // too short to scan by prefix (<3 chars, e.g. the habits head's 'h'). These are
    // scanned ONLY in freshly-REBUILT sections, never in inherited ones — an inherited
    // section legitimately cross-references a shared head rule id in prose (e.g.
    // applicableDecisions citing '(h-habit-cap)'), but a REBUILT builder section must
    // emit the variant's OWN rule ids, so a builder hardcoding a head rule id is a leak.
    const ruleIdTokens =
      typeof ht?.rulePrefix === 'string' && ht.rulePrefix.length >= 3
        ? []
        : (ht?.ruleIds ?? []).filter((r) => typeof r === 'string' && r.length > 0);
    const inheritedSections = new Set(beat.inheritedSections ?? []);
    for (const key of beat.derivedSections ?? []) {
      let sectionStr = JSON.stringify(bible[key] ?? null);
      // Occurrence-level exemption for the variant's OWN namespaced screenId: mask
      // the variant's own screenId (which legitimately extends the head's, e.g.
      // ONBOARD-BEGINNER-03--FALL-ASLEEP-EARLIER) BEFORE scanning, so a BARE head
      // screenId (ONBOARD-BEGINNER-03 with no goal suffix) still surfaces as a leak.
      if (
        ht &&
        typeof beat.screenId === 'string' &&
        typeof ht.screenId === 'string' &&
        beat.screenId !== ht.screenId &&
        beat.screenId.startsWith(ht.screenId)
      ) {
        sectionStr = sectionStr.split(beat.screenId).join('<OWN>');
      }
      const sectionLower = sectionStr.toLowerCase();
      for (const tok of tokens) {
        if (sectionStr.includes(tok)) {
          problems.push(
            `${beat.id}: derived section '${key}' leaks head token "${tok}" from ${beat.variantOf} (variant content must be per-variant, not the head's)`,
          );
        }
      }
      if (!(inheritedSections.has(key) && key === 'applicableDecisions')) {
        for (const tok of ruleIdTokens) {
          if (sectionStr.includes(tok)) {
            problems.push(
              `${beat.id}: section '${key}' leaks head rule id "${tok}" from ${beat.variantOf} (a rebuilt section must emit the variant's own rule ids, not the head's)`,
            );
          }
        }
      }
      for (const tok of semanticTokens) {
        if (sectionLower.includes(tok.toLowerCase())) {
          problems.push(
            `${beat.id}: derived section '${key}' leaks head SEMANTIC token "${tok}" from ${beat.variantOf} (category-sensitive facts must be built from typed per-category data, not substituted)`,
          );
        }
      }
    }

    // (3b) EXACT head rule-id rejection (Codex H1, 2026-07-10). This is a SEPARATE
    // mechanism from the broad substring scans above and is deliberately NOT subject
    // to their short-prefix or namespace exemptions — those exemptions exist only to
    // stop the substring scans firing false positives, and an exact-string match has
    // no such risk. A variant's DERIVED rulesContext / rulesCode is a typed rebuild
    // that MUST author the variant's OWN rule ids; an EXACT head rule id appearing
    // there is a leak. It slips the substring scans when the head prefix is too short
    // to scan (habits' 'h', <3 chars) AND the head rule id is not a substring of any
    // legitimate child id, so this closes that gap for EVERY family regardless of the
    // head's prefix length. It inspects rule `id` fields ONLY, never prose, so the
    // inherited applicableDecisions cross-reference that cites '(h-habit-cap)' in prose
    // is unaffected (applicableDecisions is not a rulesContext/rulesCode rule array).
    const headRuleIdSet = new Set(
      (ht?.ruleIds ?? []).filter((r) => typeof r === 'string' && r.length > 0),
    );
    if (headRuleIdSet.size) {
      const derived = new Set(beat.derivedSections ?? []);
      for (const key of ['rulesContext', 'rulesCode']) {
        if (!derived.has(key)) continue;
        const rules = Array.isArray(bible[key]) ? bible[key] : [];
        for (const rule of rules) {
          const rid = rule && typeof rule === 'object' ? rule.id : undefined;
          if (typeof rid === 'string' && headRuleIdSet.has(rid)) {
            problems.push(
              `${beat.id}: derived section '${key}' emits EXACT head rule id "${rid}" from ${beat.variantOf} ` +
                `(a rebuilt section must author the variant's own rule ids, never reuse the head's; ` +
                `exact-match rejection, independent of the head rule-prefix length)`,
            );
          }
        }
      }
    }
  }
}

// (3d) GLOBAL CROSS-BEAT RULE-ID UNIQUENESS (Fable residual, 2026-07-10).
// The per-beat EXACT head-rule-id rejection (3b) and the leak scan (3) only inspect a
// variant's DERIVED sections. A variant that AUTHORS its OWN rulesContext/rulesCode can
// reuse an EXACT head (or any peer beat's) rule id and slip every per-beat scan, the
// registry cross-check, AND the tool-contract check — proven: category-women authors
// its own bible, and setting its authored rulesCode id catw-tools-only to the head's
// cat-tools-only passed both registry and tool-contract. A rule id is the ownership
// handle for a spoken/typed rule, so it MUST name exactly one beat. Build id ->
// [beatId...] over EVERY resolved beat's rulesContext + rulesCode (authored OR derived)
// and reject any id claimed by more than one beat.
const ruleIdOwners = new Map();
for (const beat of resolvedBeats) {
  const bible = beat.resolvedBible;
  if (!bible) continue;
  // WITHIN-BEAT uniqueness: the cross-beat owner map counts each beat once (owners is a
  // Set of beat ids), so the SAME rule id appearing twice inside ONE beat's own
  // rulesContext+rulesCode keeps owners.size at 1 and slips the cross-beat check. Track
  // ids seen inside this beat (across both sections) and reject an intra-beat duplicate:
  // a rule id is the ownership handle and must name exactly one rule within a beat too.
  const seenInBeat = new Set();
  const dupInBeat = new Set();
  for (const key of ['rulesContext', 'rulesCode']) {
    const rules = Array.isArray(bible[key]) ? bible[key] : [];
    for (const rule of rules) {
      const rid = rule && typeof rule === 'object' ? rule.id : undefined;
      if (typeof rid !== 'string' || !rid.length) continue;
      if (seenInBeat.has(rid)) dupInBeat.add(rid);
      else seenInBeat.add(rid);
      if (!ruleIdOwners.has(rid)) ruleIdOwners.set(rid, new Set());
      ruleIdOwners.get(rid).add(beat.id);
    }
  }
  for (const rid of dupInBeat) {
    problems.push(
      `WITHIN-BEAT RULE-ID: rule id "${rid}" appears more than once inside beat ${beat.id}'s ` +
        `rulesContext/rulesCode — a rule id is the ownership handle and must be unique within a beat ` +
        `(the cross-beat owner map counts a beat once, so an intra-beat duplicate slips it).`,
    );
  }
}
for (const [rid, owners] of ruleIdOwners) {
  if (owners.size > 1) {
    problems.push(
      `CROSS-BEAT RULE-ID: rule id "${rid}" is claimed by ${owners.size} beats ` +
        `[${[...owners].sort().join(', ')}] — every beat's rulesContext/rulesCode rule id must be globally ` +
        `unique across beats. An AUTHORED variant reusing a head or peer rule id slips the per-beat ` +
        `derived-section scans; the id is the ownership handle and must name exactly one beat.`,
    );
  }
}

// (3c) FAMILY TYPED-PATH GUARD (fill precondition, Fable finding #2).
// The semantic-leak scan above can only bite a family whose head exposes a
// non-empty semantic-token set AND whose variants are built from typed per-family
// data. The B1-R fix wired that ONLY for the goals family (goalsSemanticTokens +
// resolveBeatStructure step 3b, gated on type === 'goals-list'). Any OTHER
// bible-bearing head with variantOf children would derive its category-sensitive
// sections through the free-text substitution path (substituteDeep, exact-token-
// only scanning) with an EMPTY semantic-token set — so the semantic noun/example-
// label leak class would be invisible for that family the moment it is filled.
//
// This guard makes that impossible for ANY family: a bible-bearing head that has
// variant children MUST (a) expose a per-family semantic-token set that MATCHES the
// canonical set regenerated from its typed family data (not merely non-empty — a
// junk/drifted set fails, Codex G1), and (b) not let any variant — even one that
// authors part of its own bible (Codex G2) — derive a category-sensitive section via
// free-text substitution. Fail, naming the family, otherwise. Goals is the only such
// family today and satisfies both, so this stays green; it forces every future family
// fill (habits, etc.) onto the safe typed path.
const CATEGORY_SENSITIVE_KEYS = ['rulesContext', 'conversation', 'flow', 'edges'];
const beatById = new Map(resolvedBeats.map((b) => [b.id, b]));
const variantsByHead = new Map();
for (const b of resolvedBeats) {
  if (!b.variantOf) continue;
  if (!variantsByHead.has(b.variantOf)) variantsByHead.set(b.variantOf, []);
  variantsByHead.get(b.variantOf).push(b);
}
for (const [headId, variants] of variantsByHead) {
  const head = beatById.get(headId);
  // Only a bible-bearing head gates: a no-bible head resolves its variants to
  // all-pending manifests (honest, nothing derived, nothing to leak).
  if (!head || !head.hasOwnBible) continue;
  const headCategory = variants[0]?.headTokens?.category ?? null;
  const family = headCategory ? `${headId} (category "${headCategory}")` : headId;
  const semanticTokens = (variants[0]?.headTokens?.semanticTokens ?? []).filter(
    (t) => typeof t === 'string' && t.length > 0,
  );
  // The INDEPENDENT canonical token set (recomputed from the typed family data in
  // dump-resolved-beats.mts, NOT via goalsSemanticTokens). null => no registered
  // typed contract exists for this head family.
  const canonical = variants[0]?.headTokens?.canonicalSemanticTokens ?? null;

  // (3c-i) FAMILY CONTRACT INTEGRITY (Codex G1, 2026-07-10). A non-empty token set
  // is not enough — it must be the RIGHT set. Verify the head's EXPORTED semantic
  // tokens against the canonical generator built from the same typed family data
  // that builds the sensitive sections. This is the STATIC guard-gated port of the
  // Vitest "semantic token set is non-trivial" assertion (variantSemanticLeak.test
  // .ts): it runs inside check:beats / CI render_guards, not Vitest-only, so a junk
  // or drifted token set fails the gate the leak scan trusts.
  const norm = (arr) =>
    JSON.stringify(
      [...new Set(arr.map((t) => String(t).toLowerCase()))].sort(),
    );
  if (canonical === null) {
    // No typed FamilyVariantContract registered for this head family.
    if (semanticTokens.length === 0) {
      problems.push(
        `FAMILY GUARD: head "${family}" is bible-bearing with ${variants.length} variant(s) but exposes NO per-family semantic tokens. ` +
          `Its variants would derive category-sensitive sections via free-text substitution (exact-token-only scanning), ` +
          `making the semantic noun/example-label leak class (B1-R) invisible for this family. ` +
          `Add typed per-family data + a non-empty semantic-token set (mirror goalsCategoryData/goalsSemanticTokens) before filling this head's bible.`,
      );
    } else {
      problems.push(
        `FAMILY CONTRACT: head "${family}" exposes semantic tokens [${semanticTokens.join(', ')}] but has NO registered typed ` +
          `FamilyVariantContract, so the guard cannot verify them against the typed data that builds its sensitive sections. ` +
          `A non-empty token set is not proof it is the CORRECT set. Register a typed per-family contract (mirror ` +
          `goalsCategoryData + the canonical generator in dump-resolved-beats.mts) so the exported token set is verifiable.`,
      );
    }
  } else if (canonical.length === 0) {
    problems.push(
      `FAMILY CONTRACT: head "${family}" resolved an EMPTY canonical token set from its typed family data — the typed ` +
        `contract cannot be empty. Fix the per-family data (goalsCategoryData) so noun/clip-root/beatId/example are present.`,
    );
  } else if (norm(semanticTokens) !== norm(canonical)) {
    problems.push(
      `FAMILY CONTRACT: head "${family}" EXPORTS semantic token set [${semanticTokens.join(', ')}] that does NOT match the ` +
        `canonical set [${canonical.join(', ')}] regenerated from the typed family data (goalsCategoryData) that BUILDS its ` +
        `sensitive sections. The exported goalsSemanticTokens has drifted from that data, so the leak scan would search for the ` +
        `wrong tokens and a real category leak would be invisible. Fix goalsSemanticTokens (or the typed data) so they agree.`,
    );
  }

  // (3c-ii) SUBSTITUTION-PATH GUARD (Codex G2, 2026-07-10). Do NOT blanket-skip a
  // variant that authors its own bible. Owning sectionManifest/identity/one section
  // does not mean it derives nothing: the resolver treats a section as child-authored
  // ONLY when that specific key is present (beatsSource.ts step 1); every OTHER
  // category-sensitive section the child does not own can still be inherited via
  // free-text substituteDeep and is recorded in inheritedSections (step 4). So inspect
  // inheritedSections for category-sensitive keys on EVERY variant. A variant is exempt
  // only when it owns every affected section AND no sensitive inherited section remains
  // — which is exactly "no category-sensitive key survives in inheritedSections", since
  // child-authored and typed-built keys are never recorded there.
  for (const v of variants) {
    const substituted = (v.inheritedSections ?? []).filter((k) =>
      CATEGORY_SENSITIVE_KEYS.includes(k),
    );
    if (substituted.length) {
      problems.push(
        `FAMILY GUARD: variant "${v.id}" of bible-bearing head "${family}" derives category-sensitive section(s) ` +
          `[${substituted.join(', ')}] via free-text substitution (substituteDeep) instead of a typed per-family builder ` +
          `(even though it authors its own bible for other sections). ` +
          `Route these through typed per-category data (as goals-list does in resolveBeatStructure step 3b) so semantic tokens are per-variant and the leak scan can see them.`,
      );
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
  // (4a) Honesty gate: a 'filled' section whose resolved content carries the
  // asserted-but-unimplemented marker is a false claim — reject it.
  for (const beat of resolvedBeats) {
    const manifest = beat.resolvedManifest;
    const bible = beat.resolvedBible;
    if (!manifest || !bible) continue;
    for (const key of SECTION_KEYS) {
      if (manifest[key] !== 'filled') continue;
      if (ASSERTED_UNIMPLEMENTED_RE.test(JSON.stringify(bible[key] ?? null))) {
        problems.push(
          `RELEASE: ${beat.id} manifest.${key} claims 'filled' but its content carries an ` +
            `asserted-but-unimplemented marker ("ASSERTED SPEC ... does not implement yet") — ` +
            `a section describing UI the render does not build cannot be 'filled'`,
        );
      }
    }
  }

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
    `no variant leaked a head token, ${ruleIdOwners.size} rule ids globally unique across beats, no non-owned 'filled' claim.` +
    (MODE === 'authoring'
      ? ' (Release mode --mode=release additionally requires every must-rule enforcer to be built/runnable.)'
      : ''),
);

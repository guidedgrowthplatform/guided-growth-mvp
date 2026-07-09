// Guard 3 of 3: SOURCE INTEGRITY.
// Fails the build when a non-authoritative source quietly becomes the render's
// runtime truth. Five families, one per drift vector named in the onboarding
// system integrity audit (gg-spec/docs/onboarding-system-audit.md, item 11):
//   A. a fallback flow source            (audit #4)
//   B. a hand-edited / consumed generated file (audit #5)
//   C. the legacy screen_contexts path   (audit #6)
//   D. an orphan audio clip / live-voice breach (audit #8)
//   E. a behavior rule that lives only in prose (audit #9)
// Each guard asserts the render-runtime CONTRACT, so it is green on the cleaned
// trunk and bites the moment a drift is reintroduced. Pairs with
// render-consistency-check.mjs + render-link-integrity-check.mjs.

import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const flowDesignerDir = path.join(root, 'src/components/flow-designer');
const beatsSourcePath = path.join(flowDesignerDir, 'beatsSource.ts');
const voiceObDir = path.join(root, 'public/voice/ob');

// Fallback / competing beat-source files. The render reads exactly ONE authored
// store (beatsSource.ts); any of these reappearing means a second runtime truth.
const FORBIDDEN_FALLBACK_FILES = [
  'src/components/flow-designer/onboardingMetadata.json',
  'src/onboarding-flow/flows/designer-source.json',
  'src/onboarding-flow/flows/designerSource.ts',
  'scripts/flow-sync/generate-flow.ts',
];

// Import specifiers that would pull a rival flow/beats source into the render.
const FALLBACK_SPECIFIER =
  /(designer-?[sS]ource|generate-flow|onboardingMetadata|flows\/[a-z].*flow)/;

// Generated files present on this branch. None may be consumed by the render
// runtime (flow-designer/**) or by the authored source itself.
const GENERATED_FILES = ['src/generated/screen_contexts.json', 'src/generated/icon-bundle.json'];
const GENERATED_IMPORT =
  /(generated\/(screen_contexts|icon-bundle)|screenContextsBundle|getScreenContext|screen_contexts)/;

// Only the variable name greeting may speak a live (clip-less) Cartesia line.
const NAME_GREETING_BEAT_IDS = new Set(['profile-greeting']);
const NAME_GREETING_SCREEN_IDS = new Set(['ONBOARD-01--FORM']);

// ONBOARD beats that legitimately inherit context from a parent beat rather than
// carrying their own (sub-forms). Everything else must resolve its own context.
const CONTEXT_INHERITING_TYPES = new Set(['custom-entry']);

// Behavior-critical rules from audit #9. An `enforced` rule MUST keep its machine
// anchor or it has regressed to prose-only (build fails). A `pending` rule is a
// known prose gap the render one-source finisher still owns: reported, not fatal.
// Promote to `enforced` once the anchor lands, and the guard locks it.
const PROSE_RULE_REGISTRY = [
  {
    id: 'gender-category-variant',
    desc: 'profile gender routes to the female category art',
    status: 'enforced',
    anchor: (beats) => beats.some((b) => b.type === 'category-grid' && b.props && b.props.variant),
  },
  {
    id: 'goals-count-habit-cap',
    desc: 'two goals means one habit per goal (per-goal habit loop)',
    status: 'pending',
    anchor: (beats) => beats.some((b) => b.props && b.props.perGoalHabitCap),
  },
  {
    id: 'reflection-template-drives-daily',
    desc: 'saved reflection template drives the daily reflection read path',
    status: 'pending',
    anchor: (beats) => beats.some((b) => b.props && b.props.reflectionTemplate),
  },
  {
    id: 'locale-weekday-preset',
    desc: 'schedule weekday preset follows locale',
    status: 'pending',
    anchor: (beats) => beats.some((b) => b.props && b.props.localeWeekdayPreset),
  },
  {
    id: 'greeting-completion-signal',
    desc: 'greeting advances on a completion signal, not a fixed hold',
    status: 'pending',
    anchor: (beats) => beats.some((b) => b.props && b.props.completionSignal),
  },
];

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
  return undefined;
}

function parseBeatsSource(text) {
  const sf = ts.createSourceFile(
    'beatsSource.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let arr = null;
  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'BEATS_SOURCE' &&
      node.initializer
    ) {
      const init = ts.isAsExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
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

async function listRenderRuntimeFiles() {
  const entries = await readdir(flowDesignerDir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) files.push(path.join(flowDesignerDir, e.name));
  }
  return files;
}

const problems = [];
const notes = [];

const beats = parseBeatsSource(await readFile(beatsSourcePath, 'utf8'));
const renderFiles = await listRenderRuntimeFiles();
const renderSources = await Promise.all(
  renderFiles.map(async (f) => ({ name: path.relative(root, f), text: await readFile(f, 'utf8') })),
);

function importSpecifiers(text) {
  const out = [];
  const re = /(?:import|export)[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

// A. No fallback flow source.
for (const rel of FORBIDDEN_FALLBACK_FILES) {
  if (await exists(path.join(root, rel))) {
    problems.push(
      `[fallback] ${rel} present: the render reads one source (beatsSource.ts), retire the fallback`,
    );
  }
}
for (const { name, text } of renderSources) {
  for (const spec of importSpecifiers(text)) {
    if (FALLBACK_SPECIFIER.test(spec)) {
      problems.push(
        `[fallback] ${name} imports a rival flow source "${spec}" (must read beatsSource.ts)`,
      );
    }
  }
}

// B. No generated file feeds the render runtime.
for (const rel of GENERATED_FILES) {
  if (!(await exists(path.join(root, rel)))) {
    problems.push(
      `[generated] registered generated file missing: ${rel} (stale registry or deleted source)`,
    );
  }
}
for (const { name, text } of [
  ...renderSources,
  { name: 'beatsSource.ts', text: await readFile(beatsSourcePath, 'utf8') },
]) {
  for (const spec of importSpecifiers(text)) {
    if (GENERATED_IMPORT.test(spec)) {
      problems.push(
        `[generated] ${name} imports generated/context bundle "${spec}" (render must read beatsSource.ts)`,
      );
    }
  }
}

// C. Legacy screen_contexts is not the onboarding runtime path.
for (const { name, text } of renderSources) {
  for (const spec of importSpecifiers(text)) {
    if (/screen_?[cC]ontext/.test(spec)) {
      problems.push(
        `[screen_contexts] ${name} imports legacy screen-context path "${spec}" (onboarding resolves beat context)`,
      );
    }
  }
}
for (const beat of beats) {
  const sid = beat.screenId ?? '';
  if (!sid.startsWith('ONBOARD')) continue;
  if (CONTEXT_INHERITING_TYPES.has(beat.type)) continue;
  if (!beat.context) {
    problems.push(
      `[screen_contexts] ${beat.id} (${sid}) has no beat context and is not a context-inheriting type`,
    );
  }
}

// D. Audio ownership: no orphan clip, no live voice outside the name greeting.
const referenced = new Set();
for (const beat of beats) {
  for (const line of beat.script ?? []) {
    if (line.clip) referenced.add(line.clip.replace(/\.wav$/, ''));
    if (line.clipPath) {
      const m = line.clipPath.match(/([^/]+)\.wav$/);
      if (m) referenced.add(m[1]);
    }
  }
  for (const n of beat.legacy?.narration ?? [])
    if (n && n.clip) referenced.add(String(n.clip).replace(/\.wav$/, ''));
  for (const e of beat.legacy?.elements ?? [])
    if (e && e.clip) referenced.add(String(e.clip).replace(/\.wav$/, ''));
}
const obWavs = (await readdir(voiceObDir))
  .filter((f) => /\.wav$/.test(f))
  .map((f) => f.replace(/\.wav$/, ''));
for (const id of obWavs) {
  if (!referenced.has(id)) {
    problems.push(
      `[audio] orphan clip public/voice/ob/${id}.wav: shipped but no beat script references it`,
    );
  }
}
for (const beat of beats) {
  const isGreeting =
    NAME_GREETING_BEAT_IDS.has(beat.id) || NAME_GREETING_SCREEN_IDS.has(beat.screenId);
  if (isGreeting) continue;
  for (const line of beat.script ?? []) {
    if (line.voice === 'cartesia' && !line.clip) {
      problems.push(
        `[audio] ${beat.id} script line ${line.seq} speaks live Cartesia without a clip (only the name greeting may)`,
      );
    }
  }
}

// E. Behavior rules must be machine-anchored, not prose-only.
for (const rule of PROSE_RULE_REGISTRY) {
  const anchored = rule.anchor(beats);
  if (rule.status === 'enforced' && !anchored) {
    problems.push(
      `[prose-rule] "${rule.id}" (${rule.desc}) lost its machine anchor: regressed to prose-only`,
    );
  }
  if (rule.status === 'pending' && !anchored) {
    notes.push(
      `prose-only rule not yet a machine contract (finisher-owned): ${rule.id} - ${rule.desc}`,
    );
  }
  if (rule.status === 'pending' && anchored) {
    notes.push(
      `prose-only rule "${rule.id}" now anchored: promote its registry status to "enforced" to lock it`,
    );
  }
}

if (notes.length) {
  console.log('Source-integrity notes:');
  for (const n of notes) console.log(`  - ${n}`);
  console.log('');
}

if (problems.length) {
  console.error('Source-integrity check FAILED.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  `Source-integrity check passed: ${beats.length} beats, no fallback/generated/screen_contexts runtime source, ${obWavs.length} clips all referenced, voice rule + behavior anchors intact.`,
);

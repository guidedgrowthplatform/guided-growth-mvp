// Second-source reconcile guard for src/components/flow-designer/beatMetadata.ts.
//
// beatsSource.ts (the render, "THE ONE SOURCE") owns the behavioral facts for
// every onboarding beat: voiceEngine, voiceMode, allowedTools, expectedResponse
// (BeatEntry, looked up via BEAT_BY_SCREEN_ID). beatMetadata.ts is a SEPARATE
// file, Sheet-synced by scripts/voice-sync/gen_beat_metadata.py, that used to
// carry its own copies of those same four fields for FlowBuilder.tsx's
// authoring panel. Nothing compared the two, so they could silently disagree
// (gg-spec/docs/whole-system-onboarding-qa-2026-07-10.md, finding B5: "a
// Sheet sync can change engine, mode, opener, expected response, tools ...
// without touching beatsSource.ts or failing check:beats").
//
// The fix: those four fields are retired from beatMetadata.ts entirely.
// FlowBuilder.tsx now derives them live from beatsSource.ts via BEAT_BY_SCREEN_ID
// (see withRenderFacts), so they cannot drift because there is no second copy
// left to drift. What remains in beatMetadata.ts is authoring content the render
// does not model at all (spokenContent seed text, per-form-field perElement
// micro-lines, openerMode, openerShowsAsBubble) -- see beatMetadata.ts's header
// for why those can't fold into beatsSource.ts yet (no equivalent granularity;
// inventing one would be a content decision, out of scope here).
//
// This check guards the remaining, narrower surface so it can't quietly grow
// back into a second behavioral source or drift out of sync with the render:
//   1. None of the four retired fields (voiceEngine, voiceMode, allowedTools,
//      expectedResponse) may reappear in beatMetadata.ts. If they do, either
//      the generator regressed or someone hand-added a duplicate of render data.
//   2. Every screen_id key in beatMetadata.ts must resolve to a real beat in
//      beatsSource.ts (BEAT_BY_SCREEN_ID). A key that doesn't resolve is a
//      stale entry left behind by a beat rename/removal in the render.
//   3. FlowBuilder.tsx must still import BEAT_BY_SCREEN_ID from beatsSource.ts
//      and read voiceEngine/voiceMode/allowedTools/expectedResponse from it
//      (not from BEAT_METADATA), so the wiring can't quietly revert to the old
//      Sheet-only path.
//
// Pair with scripts/render-consistency-check.mjs (guard 1) and
// scripts/render-link-integrity-check.mjs (guard 2). Wired into check:beats.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const beatMetadataPath = path.join(root, 'src/components/flow-designer/beatMetadata.ts');
const beatsSourcePath = path.join(root, 'src/components/flow-designer/beatsSource.ts');
const flowBuilderPath = path.join(root, 'src/components/flow-designer/FlowBuilder.tsx');

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isNumericLiteral(node)) return Number(node.text);
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

// Finds `export const <exportName>: ... = { "key": {...}, ... };` and returns
// { key -> plain object }.
function parseRecordLiteral(text, fileLabel, exportName) {
  const sf = ts.createSourceFile(fileLabel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let objectLit = null;
  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === exportName &&
      node.initializer
    ) {
      const init = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (ts.isObjectLiteralExpression(init)) objectLit = init;
      return;
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (!objectLit) throw new Error(`Could not find ${exportName} in ${fileLabel}`);
  const out = {};
  for (const prop of objectLit.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = ts.isStringLiteral(prop.name) ? prop.name.text : prop.name.getText();
    out[key] = literalValue(prop.initializer);
  }
  return out;
}

// Same shape as beatsSource.ts's own BEATS_SOURCE array literal (see
// render-consistency-check.mjs); pulls just the screen_id set here.
function parseBeatsSourceScreenIds(text) {
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
  const ids = new Set();
  for (const el of arr.elements) {
    const beat = literalValue(el);
    if (beat.screenId) ids.add(beat.screenId);
  }
  return ids;
}

const problems = [];

const RETIRED_FIELDS = ['voiceEngine', 'voiceMode', 'allowedTools', 'expectedResponse'];

// Pre-existing beat-INVENTORY gaps between the (older) FlowBuilder tool and the
// render, found while building this check (2026-07-10). These are a different,
// deeper problem than the second-source field drift this check otherwise
// guards (B5): the render restructured or dropped the beat entirely, so there
// is no screenId to reconcile against yet, and inventing one is a content
// decision outside a wiring-only pass.
//   - ONBOARD-BEGINNER-02: the render replaced the single generic "goals" beat
//     with 8 category-scoped variants (goals-sleep, goals-move, goals-eat, ...;
//     screenId ONBOARD-BEGINNER-02--<CATEGORY>). No bare ONBOARD-BEGINNER-02
//     beat exists in beatsSource.ts to resolve against.
//   - ONBOARD-WHY-INTRO: no beat with this screenId (or an equivalent "why"
//     intro concept) exists anywhere in beatsSource.ts; whether this beat was
//     cut, merged, or simply not yet ported to the render is undetermined here.
// Do not add to this list for a field-drift fix -- it exists ONLY for a beat
// beatsSource.ts has no representation of at all. Whoever reconciles the beat
// inventory (see GRAND-PLAN.md) should resolve these and remove the allowlist
// entries as part of that work, not this check.
const PRE_EXISTING_INVENTORY_GAPS = new Set(['ONBOARD-BEGINNER-02', 'ONBOARD-WHY-INTRO']);

const beatMetadataText = await readFile(beatMetadataPath, 'utf8');
const beatMetadata = parseRecordLiteral(beatMetadataText, 'beatMetadata.ts', 'BEAT_METADATA');
const beatsSourceText = await readFile(beatsSourcePath, 'utf8');
const renderScreenIds = parseBeatsSourceScreenIds(beatsSourceText);

for (const [screenId, meta] of Object.entries(beatMetadata)) {
  for (const field of RETIRED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(meta, field)) {
      problems.push(
        `beatMetadata.ts["${screenId}"]: carries retired field "${field}" -- this is a render-owned ` +
          `fact (beatsSource.ts BeatEntry.${field}), reintroducing it here reopens the second-source drift`,
      );
    }
  }
  if (!renderScreenIds.has(screenId) && !PRE_EXISTING_INVENTORY_GAPS.has(screenId)) {
    problems.push(
      `beatMetadata.ts["${screenId}"]: no beat in beatsSource.ts has this screenId -- stale entry ` +
        `(beat renamed or removed from the render without updating beatMetadata.ts)`,
    );
  }
}

// FlowBuilder.tsx must still derive the retired fields from beatsSource.ts,
// not from beatMetadata.ts, so the closed drift path can't silently reopen.
const flowBuilderText = await readFile(flowBuilderPath, 'utf8');
if (!/from ['"]\.\/beatsSource['"]/.test(flowBuilderText)) {
  problems.push('FlowBuilder.tsx no longer imports from beatsSource.ts (expected BEAT_BY_SCREEN_ID import)');
}
if (!/BEAT_BY_SCREEN_ID/.test(flowBuilderText)) {
  problems.push(
    'FlowBuilder.tsx no longer references BEAT_BY_SCREEN_ID -- voiceEngine/voiceMode/allowedTools/' +
      'expectedResponse must be derived from beatsSource.ts, not re-authored',
  );
}

if (problems.length) {
  console.error('Beat-metadata RECONCILE check failed.\n');
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  `Beat-metadata RECONCILE check passed: ${Object.keys(beatMetadata).length} beatMetadata.ts entries, ` +
    'no retired fields, all screen_ids resolve against beatsSource.ts, FlowBuilder.tsx reads render facts live.',
);

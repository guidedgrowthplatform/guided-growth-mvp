// App-side parity check (B4, PARITY-IN-CI).
//
// The render publishes a contract at dist-flow/parity.json (built by
// scripts/export-render-parity.mjs from beatsSource.ts#BEATS_SOURCE — see that
// file for the schema). Before this check, the only "parity" guard was a
// static string compare against the export itself; nothing asked whether the
// APP actually agrees with what got published. This script cross-references
// the published contract against three real, independently-sourced,
// app-consumed inputs:
//
//   1. Beat ORDER    <- src/generated/screen_contexts.json `routes[]`, the
//                       bundle useOnboardingVoiceSession/OnboardingVoiceProvider
//                       reads at runtime via getBundledRoutes().
//   2. Opener COPY   <- src/components/onboarding/onboardingOpeners.ts
//                       ONBOARDING_OPENERS, read live by useOnboardingChat.ts.
//   3. Audio CLIP ids <- public/voice/**, the actual shipped assets (vite.flow
//                       .config.ts's publicDir bundles the SAME public/ into
//                       the render build, so this is one shared truth, not a
//                       proxy).
//
// None of these three app-side sources currently covers every beat in the
// render (the render's beat set has grown past the app's Phase 1 bundle and
// past what the live chat has openers authored for — this is the exact
// drift the 2026-07-10 whole-system QA gate (B4/B5) called out). So:
//   - A screenId/clip missing on the APP side is reported but does NOT fail
//     the check (partial coverage is expected right now).
//   - A screenId/clip present on BOTH sides that DISAGREES fails the check.
//   - An order inversion between the two ordered sequences fails the check.
//
// This makes the parity gate meaningful now (it can catch a real divergence)
// without demanding day-one 100% app coverage, which would make it noise no
// one reads. Run standalone: `node scripts/check-app-parity.mjs`. Wired into
// CI as a REPORT-MODE job (allow_failure: true) alongside render_guards;
// promote to blocking once a deliberately-wrong change has been proven to
// fail it and the current branch passes clean (per the QA gate's own rule).

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const EXPECTED_SCHEMA_VERSION = 2;

const parityJsonPath = process.env.PARITY_JSON_PATH
  ? path.resolve(root, process.env.PARITY_JSON_PATH)
  : path.join(root, 'dist-flow/parity.json');
const parityUrl = process.env.PARITY_URL ?? null;

const screenContextsPath = path.join(root, 'src/generated/screen_contexts.json');
const openersPath = path.join(root, 'src/components/onboarding/onboardingOpeners.ts');
const publicDir = path.join(root, 'public');

let failed = false;
const lines = [];
function log(msg) {
  lines.push(msg);
  console.log(msg);
}
function fail(msg) {
  failed = true;
  log(`FAIL: ${msg}`);
}

// --- 1. Load the published render contract -------------------------------

async function loadParity() {
  if (parityUrl) {
    try {
      const res = await fetch(parityUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      log(`Loaded parity.json from PARITY_URL (${parityUrl})`);
      return await res.json();
    } catch (err) {
      log(`WARN: could not fetch PARITY_URL (${parityUrl}): ${err.message}. Falling back to local file.`);
    }
  }
  const text = await readFile(parityJsonPath, 'utf8');
  log(`Loaded parity.json from ${path.relative(root, parityJsonPath)}`);
  return JSON.parse(text);
}

const parity = await loadParity();

if (parity.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
  fail(
    `parity.json schemaVersion is ${JSON.stringify(parity.schemaVersion)}, this checker was written for ` +
      `${EXPECTED_SCHEMA_VERSION}. Update check-app-parity.mjs before trusting its result against the new shape.`,
  );
}

const beats = Array.isArray(parity.beats) ? parity.beats : [];
log(`parity.json declares ${beats.length} beats.`);

// --- 2. Load the app's real order + opener + audio sources ----------------

async function loadAppRoutes() {
  const bundle = JSON.parse(await readFile(screenContextsPath, 'utf8'));
  return (bundle.routes ?? []).map((r) => r.screen_id);
}

function objectLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
          ? prop.name.text
          : prop.name.getText();
      out[key] = objectLiteralValue(prop.initializer);
    }
    return out;
  }
  return undefined;
}

async function loadAppOpeners() {
  const text = await readFile(openersPath, 'utf8');
  const sf = ts.createSourceFile(openersPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found;
  (function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'ONBOARDING_OPENERS' &&
      node.initializer
    ) {
      found = objectLiteralValue(node.initializer);
      return;
    }
    ts.forEachChild(node, visit);
  })(sf);
  if (!found) throw new Error(`Could not find ONBOARDING_OPENERS in ${openersPath}`);
  return found;
}

const appOrder = await loadAppRoutes();
const appOpeners = await loadAppOpeners();

log(`App route bundle declares order for ${appOrder.length} screens.`);
log(`App ONBOARDING_OPENERS declares copy for ${Object.keys(appOpeners).length} screens.`);

// --- 3. Beat order: overlapping screenIds must appear in the same relative
//        sequence on both sides. Missing on either side is fine (partial
//        coverage); an INVERSION between the two is not. ------------------

function firstSeenOrder(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

const parityOrder = firstSeenOrder(beats.map((b) => b.screenId));
const appOrderUnique = firstSeenOrder(appOrder);

const shared = new Set(parityOrder.filter((id) => appOrderUnique.includes(id)));
const parityRestricted = parityOrder.filter((id) => shared.has(id));
const appRestricted = appOrderUnique.filter((id) => shared.has(id));

log(`Order check: ${shared.size} screenIds appear in both the render and the app bundle.`);
if (shared.size === 0) {
  log('  (no overlap yet — order check has nothing to compare; not a failure)');
} else if (JSON.stringify(parityRestricted) === JSON.stringify(appRestricted)) {
  log('  MATCH: shared screenIds are in the same relative order on both sides.');
} else {
  fail(
    `beat order diverges between the render and the app for shared screenIds.\n` +
      `  render order: ${parityRestricted.join(' -> ')}\n` +
      `  app order:    ${appRestricted.join(' -> ')}`,
  );
}

// --- 4. Opener copy: every screenId the app declares an opener for must
//        match what the render publishes for that screenId, wherever the
//        render also declares one. ------------------------------------

let openerMatched = 0;
let openerMismatched = 0;
let openerAppOnly = 0;
for (const [screenId, appText] of Object.entries(appOpeners)) {
  const renderBeats = beats.filter((b) => b.screenId === screenId);
  if (renderBeats.length === 0) {
    openerAppOnly += 1;
    continue;
  }
  for (const beat of renderBeats) {
    if (beat.opener == null) continue; // render has no opener claim for this beat; nothing to compare
    if (beat.opener === appText) {
      openerMatched += 1;
    } else {
      openerMismatched += 1;
      fail(
        `opener mismatch on ${screenId} (render beat "${beat.id}"):\n` +
          `  render: ${JSON.stringify(beat.opener)}\n` +
          `  app:    ${JSON.stringify(appText)}`,
      );
    }
  }
}
log(
  `Opener check: ${openerMatched} matched, ${openerMismatched} mismatched, ` +
    `${openerAppOnly} app-only screenIds not yet in the render (informational).`,
);

// --- 5. Audio clip ids: every clip the render publishes must resolve to a
//        real shipped file (the same public/ the app serves). -------------

let clipChecked = 0;
let clipMissing = 0;
const clipCache = new Map();
async function fileExists(relPath) {
  if (clipCache.has(relPath)) return clipCache.get(relPath);
  const abs = path.join(publicDir, relPath);
  const ok = await access(abs)
    .then(() => true)
    .catch(() => false);
  clipCache.set(relPath, ok);
  return ok;
}

for (const beat of beats) {
  for (const { clip, clipPath } of beat.clips ?? []) {
    if (!clipPath) {
      fail(`beat "${beat.id}" declares clip "${clip}" with no clipPath to verify.`);
      continue;
    }
    clipChecked += 1;
    const exists = await fileExists(clipPath);
    if (!exists) {
      clipMissing += 1;
      fail(`beat "${beat.id}" clip "${clip}" points at ${clipPath}, no such file under public/.`);
    }
  }
}
log(`Audio clip check: ${clipChecked} clip references checked, ${clipMissing} missing on disk.`);

// --- Summary ---------------------------------------------------------------

log('');
if (failed) {
  log('RESULT: FAIL — see FAIL lines above.');
  process.exit(1);
} else {
  log('RESULT: PASS — no divergence found between the render contract and the checked app sources.');
  process.exit(0);
}

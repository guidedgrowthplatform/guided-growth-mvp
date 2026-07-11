// Render parity check (app engine <-> render contract).
//
// The render publishes the canonical onboarding order + copy at
// https://gg-onboarding-render.pages.dev/parity.json (schemaVersion 2, source
// beatsSource.ts#BEATS_SOURCE). This script runs flow:sync and cross-checks the
// app engine's generated view (src/generated/onboarding_combined.json for order,
// src/generated/beat_contexts.json for openers) against that contract.
//
// SEMANTICS (partial-coverage tolerant, aligned with the render team's own
// authoritative app-parity check, scripts/check-app-parity.mjs on
// builder/converge-beat-spec): the render's beat set has grown PAST the app's
// (per-category goal + per-goal habit variants, the split profile asks beat,
// etc. are render beats the app engine renders as a single dynamic screen or
// does not enumerate). Those are the render's `variantOf` sub-beats and Phase-2
// coverage, not order/copy drift. So:
//   - A screenId present on the render but NOT the app (render-only) is TOLERATED
//     (partial coverage is expected right now).
//   - A screenId present on the app but NOT the render (app-only, e.g. the
//     generic ONBOARD-BEGINNER-02 goals screen the render splits into
//     ONBOARD-BEGINNER-02--<category>) is TOLERATED.
//   - A screenId present on BOTH whose opener DISAGREES fails the check.
//   - An order inversion between the two shared sequences fails the check.
//
// The custom-entry detour beats (ONBOARD-BEGINNER-02-CUSTOM / -03-CUSTOM) are
// reached by runtime navigation, not the linear nextId chain, so the app appends
// them after the main chain; they are compared by opener (shared) but excluded
// from the linear ORDER comparison (same treatment the render's own check gives
// side routes).
//
// The predecessor of this file (the 2026-07-07 render-parity-gate version) did a
// strict positional diff; it predates the render's variant expansion and can no
// longer pass for any app that collapses variants (the correct app architecture).
// This version restores a MEANINGFUL gate: run `node scripts/render-parity-check.mjs`.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const DEFAULT_RENDER_PARITY_URL = 'https://gg-onboarding-render.pages.dev/parity.json';
const RENDER_PARITY_URL = process.env.RENDER_PARITY_URL ?? DEFAULT_RENDER_PARITY_URL;
// The coach greeting speaks before the app engine's first real screen; no app node.
const RENDER_ONLY_SCREEN_IDS = new Set(['COACH-GREETING']);
// Detour beats: reached by navigation, not the linear chain. Opener-compared, not
// position-compared.
const SIDE_ROUTE_SCREEN_IDS = new Set(['ONBOARD-BEGINNER-02-CUSTOM', 'ONBOARD-BEGINNER-03-CUSTOM']);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function loadJsonFromPathOrUrl(location) {
  if (/^https?:\/\//.test(location)) {
    const response = await fetch(location, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`GET ${location} returned ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
  return JSON.parse(await readFile(location, 'utf8'));
}

function runFlowSync() {
  const result = spawnSync('npm', ['run', 'flow:sync'], { stdio: 'inherit', shell: false });
  if (result.status !== 0) fail(`npm run flow:sync failed with exit code ${result.status}`);
}

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

// The app opener for a screenId: the frontend beat bundle (beat_contexts.json)
// wins when it declares one, else the combined per-beat view.
function appOpenerFor(screenId, beatContexts, combinedBeat) {
  const bc = beatContexts.beats[screenId];
  if (bc && Object.prototype.hasOwnProperty.call(bc, 'opener')) return bc.opener ?? null;
  return combinedBeat?.opener ?? null;
}

runFlowSync();

const [renderExport, onboardingCombined, beatContexts] = await Promise.all([
  loadJsonFromPathOrUrl(RENDER_PARITY_URL),
  loadJsonFromPathOrUrl('src/generated/onboarding_combined.json'),
  loadJsonFromPathOrUrl('src/generated/beat_contexts.json'),
]);

if (!Array.isArray(renderExport.beats)) {
  fail(`Render parity export at ${RENDER_PARITY_URL} did not contain a beats array`);
}
if (!Array.isArray(onboardingCombined.beats)) {
  fail('src/generated/onboarding_combined.json did not contain a beats array');
}
if (!beatContexts.beats || typeof beatContexts.beats !== 'object') {
  fail('src/generated/beat_contexts.json did not contain a beats object');
}

// Render side: screen beats in first-seen order, minus the render-only greeting.
const renderScreenBeats = renderExport.beats.filter(
  (b) => b.screenId && !RENDER_ONLY_SCREEN_IDS.has(b.screenId),
);
const renderOrder = firstSeenOrder(renderScreenBeats.map((b) => b.screenId));
const renderOpener = new Map();
for (const b of renderExport.beats) {
  if (b.screenId && b.opener != null && !renderOpener.has(b.screenId)) {
    renderOpener.set(b.screenId, b.opener);
  }
}

// App side: screen beats in first-seen order + resolved openers.
const combinedByScreen = new Map(onboardingCombined.beats.map((b) => [b.screenId, b]));
const appOrder = firstSeenOrder(onboardingCombined.beats.map((b) => b.screenId));
const appOpener = new Map();
for (const screenId of appOrder) {
  appOpener.set(screenId, appOpenerFor(screenId, beatContexts, combinedByScreen.get(screenId)));
}

const appSet = new Set(appOrder);
const renderSet = new Set(renderOrder);
const shared = renderOrder.filter((id) => appSet.has(id));

console.log(`Render parity source: ${RENDER_PARITY_URL}`);
console.log(
  `Render screen beats: ${renderOrder.length} | App screen beats: ${appOrder.length} | Shared: ${shared.length}`,
);
console.log(
  `Render-only (partial coverage, tolerated): ${renderOrder.filter((id) => !appSet.has(id)).length}`,
);
console.log(
  `App-only (tolerated): ${appOrder.filter((id) => !renderSet.has(id)).join(', ') || '(none)'}`,
);

let ok = true;

// ORDER: shared screenIds (minus side routes) must appear in the same relative order.
const renderLinearShared = renderOrder.filter(
  (id) => appSet.has(id) && !SIDE_ROUTE_SCREEN_IDS.has(id),
);
const appLinearShared = appOrder.filter(
  (id) => renderSet.has(id) && !SIDE_ROUTE_SCREEN_IDS.has(id),
);
if (JSON.stringify(renderLinearShared) === JSON.stringify(appLinearShared)) {
  console.log(
    `PASS order: ${renderLinearShared.length} shared screenIds in the same relative order`,
  );
} else {
  ok = false;
  console.log('FAIL order: shared screenIds diverge');
  console.log(`  render: ${renderLinearShared.join(' -> ')}`);
  console.log(`  app:    ${appLinearShared.join(' -> ')}`);
}

// OPENER: every shared screenId the render declares an opener for must match.
let matched = 0;
let mismatched = 0;
for (const id of shared) {
  const r = renderOpener.get(id);
  if (r == null) continue; // render makes no opener claim for this screenId
  const a = appOpener.get(id) ?? null;
  if (r === a) {
    matched += 1;
  } else {
    ok = false;
    mismatched += 1;
    console.log(`FAIL opener ${id}`);
    console.log(`  render: ${JSON.stringify(r)}`);
    console.log(`  app:    ${JSON.stringify(a)}`);
  }
}
console.log(
  `Opener check: ${matched} matched, ${mismatched} mismatched (shared screenIds with a render opener).`,
);

if (!ok) {
  console.error('Render parity check failed.');
  process.exit(1);
}
console.log('Render parity check passed.');

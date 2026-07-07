import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const DEFAULT_RENDER_PARITY_URL = 'https://gg-onboarding-render.pages.dev/parity.json';
const RENDER_PARITY_URL = process.env.RENDER_PARITY_URL ?? DEFAULT_RENDER_PARITY_URL;
const SIDE_ROUTE_SCREEN_IDS = new Set(['ONBOARD-BEGINNER-02-CUSTOM', 'ONBOARD-BEGINNER-03-CUSTOM']);
const RENDER_ONLY_SCREEN_IDS = new Set(['COACH-GREETING']);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function loadJsonFromPathOrUrl(location) {
  if (location.startsWith('file://')) {
    return JSON.parse(await readFile(new URL(location), 'utf8'));
  }

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
  const result = spawnSync('npm', ['run', 'flow:sync'], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    fail(`npm run flow:sync failed with exit code ${result.status}`);
  }
}

function collapseConsecutiveDuplicates(beats) {
  const out = [];
  for (const beat of beats) {
    if (out.at(-1)?.screenId === beat.screenId) continue;
    out.push(beat);
  }
  return out;
}

function normalizeRenderBeats(renderBeats) {
  const screenBeats = renderBeats.filter(
    (beat) => beat.screenId && !RENDER_ONLY_SCREEN_IDS.has(beat.screenId),
  );
  return collapseConsecutiveDuplicates(screenBeats);
}

function appOpenerFor(screenId, beatContexts, combinedBeat) {
  if (Object.prototype.hasOwnProperty.call(beatContexts.beats[screenId] ?? {}, 'opener')) {
    return beatContexts.beats[screenId].opener ?? null;
  }

  return combinedBeat?.opener ?? null;
}

function normalizeAppBeats(combinedBeats, beatContexts) {
  return combinedBeats
    .filter((beat) => beat.screenId)
    .map((beat, index) => ({
      index: index + 1,
      screenId: beat.screenId,
      opener: appOpenerFor(beat.screenId, beatContexts, beat),
    }));
}

function compareBeat(label, renderBeat, appBeat) {
  const checks = [];

  checks.push({
    name: 'screenId',
    pass: renderBeat?.screenId === appBeat?.screenId,
    expected: renderBeat?.screenId ?? '<missing>',
    actual: appBeat?.screenId ?? '<missing>',
  });
  checks.push({
    name: 'opener',
    pass: (renderBeat?.opener ?? null) === (appBeat?.opener ?? null),
    expected: renderBeat?.opener ?? null,
    actual: appBeat?.opener ?? null,
  });

  const pass = checks.every((check) => check.pass);
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`${status} ${label}`);
  for (const check of checks) {
    if (check.pass) {
      console.log(`  PASS ${check.name}`);
    } else {
      console.log(`  FAIL ${check.name}`);
      console.log(`    expected: ${JSON.stringify(check.expected)}`);
      console.log(`    actual:   ${JSON.stringify(check.actual)}`);
    }
  }

  return pass;
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

const renderBeats = normalizeRenderBeats(renderExport.beats);
const appBeats = normalizeAppBeats(onboardingCombined.beats, beatContexts);
const renderLinearBeats = renderBeats.filter((beat) => !SIDE_ROUTE_SCREEN_IDS.has(beat.screenId));
const appLinearBeats = appBeats.filter((beat) => !SIDE_ROUTE_SCREEN_IDS.has(beat.screenId));
const appByScreenId = new Map(appBeats.map((beat) => [beat.screenId, beat]));

console.log(`Render parity source: ${RENDER_PARITY_URL}`);
console.log(`Linear render beats: ${renderLinearBeats.length}`);
console.log(`Linear app beats: ${appLinearBeats.length}`);

let ok = true;
const maxLinear = Math.max(renderLinearBeats.length, appLinearBeats.length);
for (let i = 0; i < maxLinear; i += 1) {
  ok = compareBeat(`linear ${i + 1}`, renderLinearBeats[i], appLinearBeats[i]) && ok;
}

for (const renderBeat of renderBeats.filter((beat) => SIDE_ROUTE_SCREEN_IDS.has(beat.screenId))) {
  ok =
    compareBeat(
      `side route ${renderBeat.screenId}`,
      renderBeat,
      appByScreenId.get(renderBeat.screenId),
    ) && ok;
}

if (!ok) {
  console.error('Render parity check failed.');
  process.exit(1);
}

console.log('Render parity check passed.');

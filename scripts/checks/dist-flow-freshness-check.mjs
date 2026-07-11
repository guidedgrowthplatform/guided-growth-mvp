// Registry id: dist-flow-freshness-check
//
// Guards against exactly the bug Codex QA found on 2026-07-11: the tracked
// generated render bundle in dist-flow/ was last built at an old commit
// (d2959292) and kept shipping retired-behavior tokens (the help-you-decide
// brainstorming section + its catw-stay-open / gsleep-stay-open / cat-stay-open
// / eval:brainstorm-then-yield artifacts) for two commits after source removed
// every reference to them. Source was clean; the committed ARTIFACT was stale.
// No existing check/git-diff review catches this class of bug because a
// tracked build output can silently drift from the source that generates it
// whenever a change lands without a `npm run build:flow` rebuild.
//
// This check does not (and cannot) prove dist-flow is fully up to date with
// source — that would require a full rebuild-and-diff, which is expensive and
// is `scripts/check-app-parity.mjs` / `scripts/render-consistency-check.mjs`'s
// job for structural drift. This check is narrower and cheap: it scans the
// tracked dist-flow/ directory for a small denylist of tokens that name
// SPECIFIC retired behavior, so a stale artifact that still embeds a killed
// feature is caught even if nobody remembers to grep for it by hand.
//
// Scope: dist-flow ONLY. src/ and docs/ legitimately reference these same
// strings in comments, changelogs, and negative-test fixtures describing the
// removal itself (see e.g. flowBible.ts:830, beatsSource.ts:740) — that is
// history, not a live bug, so this check must never scan outside dist-flow.
//
// Extend the DENYLIST below whenever a future change retires another
// beat/rule/response id or a distinctive prose phrase from the LIVE render
// and you want a guard against the artifact going stale again.
//
// Run: `node scripts/checks/dist-flow-freshness-check.mjs` (wired into
// `check:beats` as `check:dist-flow-freshness`).

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_FLOW_DIR = path.join(ROOT, 'dist-flow');

// Text-ish extensions worth scanning. dist-flow also carries binary media
// (mp3/wav/png/jpg/webp/svg) that can never contain these string tokens and
// would just waste time reading; skip them. `_headers` has no extension.
const SCANNABLE_EXT = new Set(['.js', '.css', '.html', '.json', '.map']);
const SCANNABLE_BASENAMES = new Set(['_headers']);

// The retired-token denylist. Each entry names the retired thing it fingerprints
// so a future violation's diagnostic is self-explanatory. Keep this the single
// source of truth for "things that must never reappear in the built artifact" —
// extend it (never replace it) as more behavior gets retired.
const DENYLIST = [
  { token: 'catw-stay-open', retired: 'category-women stay-open rule id (help-you-decide era)' },
  { token: 'gsleep-stay-open', retired: 'goals-sleep stay-open rule id (help-you-decide era)' },
  { token: 'cat-stay-open', retired: 'category stay-open rule id (help-you-decide era)' },
  {
    token: 'brainstorm-then-yield',
    retired: 'eval:brainstorm-then-yield (GLOBAL_CONTEXT brainstorming eval, removed 2026-07-10)',
  },
  {
    token: "In the next step we'll talk about which days",
    retired:
      'pre-lock advanced-capture opener fallback in advancedCapture.tsx (superseded by the row-68 locked line, removed 2026-07-11)',
  },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function isScannable(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  return SCANNABLE_EXT.has(ext) || SCANNABLE_BASENAMES.has(base);
}

const problems = [];

let allFiles;
try {
  allFiles = await walk(DIST_FLOW_DIR);
} catch (err) {
  if (err?.code === 'ENOENT') {
    console.log(
      `dist-flow-freshness-check skipped: ${DIST_FLOW_DIR} does not exist (nothing built yet).`,
    );
    process.exit(0);
  }
  throw err;
}

const scannedFiles = allFiles.filter(isScannable);

for (const filePath of scannedFiles) {
  const content = await readFile(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath);
  for (const { token, retired } of DENYLIST) {
    if (content.includes(token)) {
      problems.push(
        `${rel}: contains retired token "${token}" (${retired}) — dist-flow is stale, ` +
          `rebuild with \`npm run build:flow\``,
      );
    }
  }
}

if (problems.length) {
  console.error(`FAILED: ${problems.length} violation(s) found.\n`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

console.log(
  `dist-flow-freshness-check passed: ${scannedFiles.length} file(s) scanned under dist-flow/, ` +
    `0 of ${DENYLIST.length} retired token(s) found.`,
);

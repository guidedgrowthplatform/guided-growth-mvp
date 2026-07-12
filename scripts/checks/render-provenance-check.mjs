import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { artifactHash, resolveRenderProvenance } from '../render-provenance.mjs';

const ROOT = process.cwd();
const manifestPaths = [
  'dist-flow/parity.json',
  'dist-flow/onboarding-contract.json',
].map((file) => path.join(ROOT, file));

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`render-provenance-check: ${message}`);
  process.exit(1);
}

let expected;
try {
  expected = resolveRenderProvenance(ROOT);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const manifestPath of manifestPaths) {
  let document;
  try {
    document = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(ROOT, manifestPath)} is unreadable: ${error instanceof Error ? error.message : error}`);
  }

  const provenance = document?.provenance;
  if (!provenance || typeof provenance !== 'object') {
    fail(`${path.relative(ROOT, manifestPath)} is missing provenance.`);
  }
  for (const key of ['sourceCommit', 'branch', 'buildSha', 'artifactHash']) {
    if (typeof provenance[key] !== 'string' || provenance[key].length === 0) {
      fail(`${path.relative(ROOT, manifestPath)} has missing or invalid provenance.${key}.`);
    }
  }
  if (provenance.branch !== expected.branch) {
    fail(`${path.relative(ROOT, manifestPath)} branch is inexact.`);
  }
  if (provenance.buildSha !== expected.buildSha) {
    fail(`${path.relative(ROOT, manifestPath)} buildSha is inexact.`);
  }
  if (provenance.artifactHash !== artifactHash(document)) {
    fail(`${path.relative(ROOT, manifestPath)} artifactHash is inexact.`);
  }

  if (!/^[0-9a-f]{40}$/.test(provenance.sourceCommit)) {
    fail(`${path.relative(ROOT, manifestPath)} sourceCommit is invalid.`);
  }
  let sourceBlob;
  try {
    sourceBlob = git(['rev-parse', `${provenance.sourceCommit}:src/components/flow-designer/beatsSource.ts`]);
  } catch {
    fail(`${path.relative(ROOT, manifestPath)} sourceCommit does not resolve to the render source.`);
  }
  const currentBlob = git(['hash-object', 'src/components/flow-designer/beatsSource.ts']);
  if (sourceBlob !== currentBlob) {
    fail(`${path.relative(ROOT, manifestPath)} sourceCommit does not match the current beats source.`);
  }
}

console.log(
  `render-provenance-check passed: ${manifestPaths.length} manifests pinned to ${expected.branch} at ${expected.sourceCommit}.`,
);

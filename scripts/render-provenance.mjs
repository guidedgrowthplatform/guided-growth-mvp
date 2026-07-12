import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const GENERATED_MANIFESTS = new Set(['_headers', 'onboarding-contract.json', 'parity.json']);

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildPayloadFiles(root, directory = path.join(root, 'dist-flow')) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (GENERATED_MANIFESTS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...buildPayloadFiles(root, absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

export function resolveRenderProvenance(root = process.cwd()) {
  const branch = git(root, ['branch', '--show-current']);
  if (!branch) throw new Error('Render provenance requires a named git branch, detached HEAD is not deployable.');

  const payload = buildPayloadFiles(root)
    .sort()
    .map((file) => `${path.relative(root, file)}\0${readFileSync(file)}`);

  return {
    sourceCommit: git(root, ['rev-parse', 'HEAD']),
    branch,
    buildSha: sha256(Buffer.concat(payload.map((entry) => Buffer.from(entry)))),
  };
}

export function artifactHash(document) {
  const provenance = document?.provenance;
  if (!provenance || typeof provenance !== 'object') {
    throw new Error('Generated artifact is missing its provenance object.');
  }
  const { artifactHash: _artifactHash, ...withoutArtifactHash } = provenance;
  return sha256(`${JSON.stringify({ ...document, provenance: withoutArtifactHash }, null, 2)}\n`);
}

export function withArtifactHash(document) {
  return {
    ...document,
    provenance: {
      ...document.provenance,
      artifactHash: artifactHash(document),
    },
  };
}

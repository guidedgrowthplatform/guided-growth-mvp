import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './config.mjs';
import { parseCliArgs } from './gate-lib.mjs';

export function assertReleaseManifest(artifact, manifest) {
  const expected = manifest.artifacts?.[artifact.name] ?? manifest.artifacts?.[artifact.path];
  if (!expected) throw new Error(`Release manifest has no entry for artifact "${artifact.name ?? artifact.path}".`);
  const baked = artifact.generatedFrom ?? artifact;
  for (const field of ['contractSeq', 'hash']) {
    if (baked[field] !== expected[field]) throw new Error(`Release manifest mismatch for ${artifact.name ?? artifact.path}: ${field} artifact=${String(baked[field])} manifest=${String(expected[field])}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv, { root: repositoryRoot, artifact: null, manifest: null });
  if (!options.artifact || !options.manifest) throw new Error('Usage: node scripts/gates/assert-release-manifest.mjs --artifact artifact.json --manifest release-manifest.json');
  const root = path.resolve(options.root);
  const [artifact, manifest] = await Promise.all([readFile(path.join(root, options.artifact), 'utf8').then(JSON.parse), readFile(path.join(root, options.manifest), 'utf8').then(JSON.parse)]);
  assertReleaseManifest(artifact, manifest);
  console.log(`Release manifest assertion passed: ${options.artifact}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOnboardingContract } from './lib/readContract';
import { renderAudioManifest, verifyAudioManifestAssets } from './lib/generateAudioManifest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const defaultContractPath = resolve(root, 'src/onboarding-flow/flows/onboarding-contract.v1.json');
const defaultOutputPath = resolve(root, 'src/generated/onboarding_audio_manifest.json');
const args = process.argv.slice(2);
const valueFor = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const contractPath = resolve(
  root,
  valueFor('--contract') ?? process.env.ONBOARDING_CONTRACT_PATH ?? defaultContractPath,
);
const outputPath = resolve(root, valueFor('--output') ?? defaultOutputPath);
const check = args.includes('--check');
const verifyAssets = args.includes('--verify-assets');

const result = renderAudioManifest(readOnboardingContract(contractPath));
if (verifyAssets) verifyAudioManifestAssets(root, result.manifest);
const output = `${JSON.stringify(result.manifest, null, 2)}\n`;
const metadata = `${JSON.stringify(result.metadata, null, 2)}\n`;
const metadataPath = outputPath.replace(/\.json$/, '.meta.json');
if (check) {
  const { readFileSync } = await import('node:fs');
  if (
    readFileSync(outputPath, 'utf8') !== output ||
    readFileSync(metadataPath, 'utf8') !== metadata
  ) {
    throw new Error(`[audio-manifest] generated output is stale: ${outputPath}`);
  }
  console.log(`[audio-manifest] current: ${outputPath}`);
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output, 'utf8');
  writeFileSync(metadataPath, metadata, 'utf8');
  console.log(`[audio-manifest] wrote ${outputPath}`);
}

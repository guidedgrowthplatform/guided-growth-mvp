import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT_PATH = path.join(ROOT, 'dist-flow/onboarding-contract.json');
const OUTPUT_PATH = path.join(ROOT, 'src/generated/onboardingContract.ts');
const META_PATH = path.join(ROOT, 'src/generated/onboardingContract.meta.json');
const CHECK = process.argv.includes('--check');

type UnknownRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`generate:onboarding-engine: ${message}`);
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as UnknownRecord;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function localAssetPath(clipPath: string): string {
  if (!clipPath.startsWith('/') || clipPath.includes('..')) {
    fail(`clip path "${clipPath}" must be an absolute public path without traversal`);
  }
  return path.join(ROOT, 'public', clipPath.slice(1));
}

function validateContract(input: unknown): UnknownRecord {
  const contract = record(input, 'contract');
  if (contract.schemaVersion !== 1) {
    fail(`unsupported schemaVersion ${String(contract.schemaVersion)} (expected 1)`);
  }

  const provenance = record(contract.provenance, 'contract.provenance');
  for (const field of ['sourceCommit', 'branch', 'buildSha', 'artifactHash']) {
    const value = string(provenance[field], `contract.provenance.${field}`);
    if ((field === 'buildSha' || field === 'artifactHash') && !/^[a-f0-9]{64}$/i.test(value)) {
      fail(`contract.provenance.${field} must be a SHA-256 hash`);
    }
  }

  if (!Array.isArray(contract.beats) || contract.beats.length === 0) {
    fail('contract.beats must be a non-empty array');
  }
  const idMap = record(contract.idMap, 'contract.idMap');
  const clipMap = record(idMap.clips, 'contract.idMap.clips');
  const ids = new Set<string>();
  const orders = new Set<number>();
  const screenOwners = new Map<string, UnknownRecord>();

  for (const [index, value] of contract.beats.entries()) {
    const beat = record(value, `contract.beats[${index}]`);
    const id = string(beat.id, `contract.beats[${index}].id`);
    if (ids.has(id)) fail(`duplicate beat id "${id}"`);
    ids.add(id);
    if (typeof beat.order !== 'number' || !Number.isInteger(beat.order) || orders.has(beat.order)) {
      fail(`contract.beats[${index}].order must be a unique integer`);
    }
    orders.add(beat.order);
    const component = record(beat.component, `contract.beats[${index}].component`);
    string(component.key, `contract.beats[${index}].component.key`);

    if (typeof beat.screenId === 'string' && beat.screenId) {
      const previous = screenOwners.get(beat.screenId);
      if (previous && beat.variantOf !== previous.id) {
        fail(`duplicate screen alias "${beat.screenId}" without a variantOf link`);
      }
      if (!previous) screenOwners.set(beat.screenId, beat);
    }

    const assets = record(beat.assets, `contract.beats[${index}].assets`);
    if (!Array.isArray(assets.clips))
      fail(`contract.beats[${index}].assets.clips must be an array`);
    for (const clip of assets.clips) {
      const clipRecord = record(clip, `contract.beats[${index}].assets.clips[]`);
      const clipPath = string(
        clipRecord.clipPath,
        `contract.beats[${index}].assets.clips[].clipPath`,
      );
      if (!existsSync(localAssetPath(clipPath))) fail(`missing local clip ${clipPath}`);
    }
  }

  for (const [clipId, value] of Object.entries(clipMap)) {
    const clipPath = string(value, `contract.idMap.clips.${clipId}`);
    if (!existsSync(localAssetPath(clipPath))) fail(`missing mapped local clip ${clipPath}`);
  }

  return contract;
}

function writeOrCheck(target: string, content: string): void {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (CHECK) {
    if (current !== content)
      fail(`${path.relative(ROOT, target)} is stale. Run npm run generate:onboarding-engine`);
    return;
  }
  if (current !== content) writeFileSync(target, content);
}

const contract = validateContract(JSON.parse(readFileSync(INPUT_PATH, 'utf8')));
const beats = contract.beats as UnknownRecord[];
const screenIdToBeatId = Object.fromEntries(
  beats
    .filter((beat) => typeof beat.screenId === 'string' && beat.screenId && !beat.variantOf)
    .map((beat) => [beat.screenId as string, beat.id as string]),
);
const clipMap = record(record(contract.idMap, 'contract.idMap').clips, 'contract.idMap.clips');
const generatedModule = `/* This file is generated by scripts/generate-onboarding-engine.mts. Do not edit it by hand. */\n\nexport const onboardingContract = ${JSON.stringify(
  contract,
  null,
  2,
)} as const;\n\nexport const onboardingBeats = onboardingContract.beats;\n\nexport const onboardingBeatById = {\n${beats
  .map((beat, index) => `  ${JSON.stringify(beat.id)}: onboardingContract.beats[${index}],`)
  .join(
    '\n',
  )}\n} as const;\n\nexport const screenIdToBeatId = ${JSON.stringify(screenIdToBeatId, null, 2)} as const;\n\nexport const onboardingClipMap = ${JSON.stringify(clipMap, null, 2)} as const;\n\nexport type OnboardingContract = typeof onboardingContract;\nexport type OnboardingBeat = (typeof onboardingBeats)[number];\n`;
const provenance = record(contract.provenance, 'contract.provenance');
const meta = {
  schemaVersion: contract.schemaVersion,
  sourceCommit: provenance.sourceCommit,
  branch: provenance.branch,
  buildSha: provenance.buildSha,
  artifactHash: provenance.artifactHash,
  generatedFrom: path.relative(ROOT, INPUT_PATH),
  generatedContractSha256: createHash('sha256').update(stableJson(contract)).digest('hex'),
  beatCount: beats.length,
  clipCount: Object.keys(clipMap).length,
};

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeOrCheck(OUTPUT_PATH, generatedModule);
writeOrCheck(META_PATH, stableJson(meta));
console.log(
  `${CHECK ? 'Checked' : 'Generated'} onboarding engine input: ${beats.length} beats, ${Object.keys(clipMap).length} clips, ${String(provenance.artifactHash)}`,
);

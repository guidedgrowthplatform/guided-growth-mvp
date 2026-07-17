import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertReleaseManifest } from './assert-release-manifest.mjs';
import { findIdLiteralViolations } from './check-id-literals.mjs';
import { reportGeneratedDrift } from './check-generated-drift.mjs';
import { baselineFromHits, compareWriterBaseline, inventoryWriters } from './check-writers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (...segments) => path.join(here, '__fixtures__', ...segments);

async function temporaryRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'phaseb-gates-'));
}

async function seedContract(root) {
  await cp(path.join(process.cwd(), 'src/onboarding-flow/flows/onboarding-contract.v1.json'), path.join(root, 'contract.json'));
}

const idFixtureConfig = {
  contractPath: 'contract.json',
  runtimeRoots: ['api', 'src'],
  generatedCrosswalkPath: 'packages/shared/src/onboarding/beatIds.generated.ts',
  exactAllowlist: [],
  prefixAllowlist: [],
};

test('ID literal gate passes a clean runtime fixture', async (context) => {
  const root = await temporaryRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  await seedContract(root);
  await mkdir(path.join(root, 'api'), { recursive: true });
  await writeFile(path.join(root, 'api/clean.ts'), await readFile(fixture('id-literals/allowed/clean.ts')));
  assert.deepEqual(await findIdLiteralViolations(root, idFixtureConfig), []);
});

test('ID literal gate catches a hardcoded onboarding ID', async (context) => {
  const root = await temporaryRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  await seedContract(root);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src/violation.ts'), await readFile(fixture('id-literals/rejected/violation.ts')));
  const violations = await findIdLiteralViolations(root, idFixtureConfig);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'ONBOARD-WELCOME');
});

test('writer gate passes an inventoried writer fixture', async (context) => {
  const root = await temporaryRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'api'), { recursive: true });
  await cp(fixture('writers/clean/writer.ts'), path.join(root, 'api/writer.ts'));
  const baseline = baselineFromHits(await inventoryWriters(root));
  assert.deepEqual(compareWriterBaseline(baseline, baselineFromHits(await inventoryWriters(root))), []);
});

test('writer gate catches an extra uninventoried writer', async (context) => {
  const root = await temporaryRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'api'), { recursive: true });
  const target = path.join(root, 'api/writer.ts');
  await cp(fixture('writers/clean/writer.ts'), target);
  const baseline = baselineFromHits(await inventoryWriters(root));
  await writeFile(target, await readFile(fixture('writers/violation/writer.ts')));
  const problems = compareWriterBaseline(baseline, baselineFromHits(await inventoryWriters(root)));
  assert.ok(problems.some((problem) => problem.category === 'writer-count-increase'));
  assert.ok(problems.some((problem) => problem.category === 'uninventoried-writer'));
});

test('drift report is clean when every configured artifact exists', async (context) => {
  const root = await temporaryRoot();
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'generated'), { recursive: true });
  await writeFile(path.join(root, 'generated/one.json'), '{}\n');
  const report = await reportGeneratedDrift(root, { generatedArtifacts: ['generated/one.json'] });
  assert.deepEqual(report.missing, []);
});

test('drift report identifies a missing artifact without throwing', async () => {
  const root = await temporaryRoot();
  try {
    const report = await reportGeneratedDrift(root, { generatedArtifacts: ['generated/missing.json'] });
    assert.deepEqual(report.missing, ['generated/missing.json']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release manifest assertion passes matching baked metadata fixture', async () => {
  const artifact = JSON.parse(await readFile(fixture('release-manifest/clean-artifact.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(fixture('release-manifest/manifest.json'), 'utf8'));
  assert.doesNotThrow(() => assertReleaseManifest(artifact, manifest));
});

test('release manifest assertion catches mismatched baked metadata fixture', async () => {
  const artifact = JSON.parse(await readFile(fixture('release-manifest/violation-artifact.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(fixture('release-manifest/manifest.json'), 'utf8'));
  assert.throws(() => assertReleaseManifest(artifact, manifest), /hash/);
});

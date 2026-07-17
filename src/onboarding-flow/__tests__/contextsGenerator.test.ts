import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateContextArtifacts, projectContextArtifacts } from '../../../scripts/onboarding/generate';
import { readContract } from '../../../scripts/onboarding/lib/readContract';
import { stableJson } from '../../../scripts/onboarding/lib/serialize';

const fixture = resolve(process.cwd(), 'src/onboarding-flow/flows/onboarding-contract.v1.json');

describe('onboarding context generator', () => {
  it('is byte-stable across two projections', () => {
    const { contract, contractSha256 } = readContract(fixture);
    const metadata = { contractRevision: contract.contractRevision, contractSha256 };
    expect(stableJson(projectContextArtifacts(contract, metadata))).toBe(
      stableJson(projectContextArtifacts(contract, metadata)),
    );
  });

  it('writes byte-stable artifacts across two generator runs', () => {
    generateContextArtifacts();
    const first = readFileSync('src/generated/beat_contexts.json', 'utf8');
    generateContextArtifacts();
    expect(readFileSync('src/generated/beat_contexts.json', 'utf8')).toBe(first);
  });

  it('projects the shapes consumed by beatContexts.ts and build-beat-bundle.ts', () => {
    const { contract, contractSha256 } = readContract(fixture);
    const artifacts = projectContextArtifacts(contract, {
      contractRevision: contract.contractRevision,
      contractSha256,
    });
    expect(artifacts.backend.global).toBeTypeOf('string');
    expect(artifacts.backend.beats).toHaveProperty('welcome');
    expect(artifacts.backend.beats.welcome).toMatchObject({
      context: 'Welcome context.',
      opener: 'Welcome to Guided Growth.',
    });
    expect(artifacts.frontend.beats.profile.allowedTools).toEqual(['submit_profile']);
    expect(artifacts.frontend.allTools).toEqual(['submit_path_choice', 'submit_profile']);
  });

  it('resolves inherited context without mutating the input contract', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'onboarding-contract-'));
    const path = resolve(directory, 'contract.json');
    const source = JSON.parse(readFileSync(fixture, 'utf8'));
    source.beats[1].context = undefined;
    source.beats[1].inheritsContextFrom = 'welcome';
    writeFileSync(path, JSON.stringify(source));
    const { contract, contractSha256 } = readContract(path);
    const artifacts = projectContextArtifacts(contract, {
      contractRevision: contract.contractRevision,
      contractSha256,
    });
    expect(artifacts.backend.beats['welcome-women'].context).toBe('Welcome context.');
    expect(contract.beats[1].context).toBeUndefined();
    rmSync(directory, { recursive: true, force: true });
  });
});

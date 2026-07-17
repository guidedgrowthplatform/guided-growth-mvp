import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractToFlowDocument } from '../../../scripts/flow-sync/contractToFlow';
import { beatIdMapData, renderBeatIdsModule } from '../../../scripts/onboarding/lib/generateBeatIds';
import { parseOnboardingContract } from '../../../scripts/onboarding/lib/readContract';

const fixturePath = resolve(process.cwd(), 'src/onboarding-flow/flows/onboarding-contract.v1.json');
const fixture = () => parseOnboardingContract(readFileSync(fixturePath, 'utf8')).contract;

describe('Phase B onboarding contract pipeline', () => {
  it('parses the contract envelope and compiles it without designer source', () => {
    const contract = fixture();
    const flow = contractToFlowDocument(contract);
    expect(flow.entryNodeId).toBe('welcome');
    expect(flow.nodes.map((node) => node.id)).toEqual(['welcome', 'welcome-women', 'profile', 'path', 'category', 'finish']);
    expect(flow.nodes.filter((node) => node.screenId === 'ONBOARD-WELCOME').map((node) => node.id)).toEqual(['welcome', 'welcome-women']);
    expect(flow.nodes.find((node) => node.id === 'profile')?.screenId).toBe('ONBOARD-01--FORM');
    expect(flow.nodes.find((node) => node.id === 'path')?.meta?.toggles.suppressVapiDuringMp3).toBe(true);
  });

  it('derives legacy, Vapi, MP3, and hybrid memberships from the contract', () => {
    const data = beatIdMapData(fixture());
    expect(data.legacyScreenIdToBeatId['ONBOARD-WELCOME']).toBe('welcome');
    expect(data.legacyScreenIdToBeatId['ONBOARD-01--FORM']).toBe('profile');
    expect(data.beatIdToLegacyScreenIds.welcome).toEqual(['ONBOARD-WELCOME']);
    expect(data.vapiBeatIds).toEqual(['profile']);
    expect(data.mp3BeatIds).toEqual(['welcome', 'welcome-women']);
    expect(data.hybridBeatIds).toEqual(['path']);
    const module = renderBeatIdsModule(fixture());
    expect(module).toContain('export const BEAT_IDS');
    expect(module).toContain('export const LEGACY_SCREEN_ID_TO_BEAT_ID');
    expect(module).toContain('export const VAPI_BEAT_IDS');
    expect(module).toContain('export const MP3_BEAT_IDS');
    expect(module).toContain('export const HYBRID_BEAT_IDS');
  });

  it('rejects a crosswalk reference to a nonexistent beat', () => {
    const invalid = readFileSync(fixturePath, 'utf8').replace('"beatId": "finish"', '"beatId": "missing"');
    expect(() => parseOnboardingContract(invalid)).toThrow('unknown beat id "missing"');
  });
});

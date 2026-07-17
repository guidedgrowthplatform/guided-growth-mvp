import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractToFlowDocument } from '../../../scripts/flow-sync/contractToFlow';
import {
  beatIdMapData,
  renderBeatIdsModule,
} from '../../../scripts/onboarding/lib/generateBeatIds';
import { parseOnboardingContract } from '../../../scripts/onboarding/lib/readContract';
import type { BeatNode } from '../types';

const fixturePath = resolve(process.cwd(), 'src/onboarding-flow/flows/onboarding-contract.v1.json');
const fixture = () => parseOnboardingContract(readFileSync(fixturePath, 'utf8')).contract;

describe('Phase B onboarding contract pipeline', () => {
  it('parses the contract envelope and compiles it without designer source', () => {
    const contract = fixture();
    const flow = contractToFlowDocument(contract);
    expect(contract.contractSeq).toBe(1);
    expect(contract.beatIdToRollbackScreenId['onboarding-beat-1-splash']).toBeNull();
    expect(contract.variantToBaseBeatId['onboarding-beat-18-week-projection:best']).toBe(
      'onboarding-beat-18-week-projection',
    );
    expect(
      contract.beats.find((beat) => beat.id === 'onboarding-beat-7-state-check')?.perElement,
    ).toHaveLength(4);
    expect(flow.entryNodeId).toBe('onboarding-beat-1-splash');
    expect(flow.nodes).toHaveLength(62);
    expect(
      (
        flow.nodes.find((node) => node.id === 'onboarding-beat-6-profile:greeting') as
          | BeatNode
          | undefined
      )?.backId,
    ).toBe('onboarding-beat-5-mic-permission');
    expect(flow.nodes.find((node) => node.id === 'onboarding-beat-4-sign-up')?.screenId).toBe(
      'ONBOARD-AUTH--FORM',
    );
    expect(
      flow.nodes.find((node) => node.id === 'onboarding-beat-8-morning-checkin-setup')?.meta
        ?.toggles.suppressVapiDuringMp3,
    ).toBe(true);
  });

  it('derives legacy, Vapi, MP3, and hybrid memberships from the contract', () => {
    const data = beatIdMapData(fixture());
    expect(data.legacyScreenIdToBeatId['ONBOARD-01--FORM']).toBe(
      'onboarding-beat-6-profile:greeting',
    );
    expect(data.beatIdToLegacyScreenIds['onboarding-beat-6-profile:greeting']).toEqual([
      'ONBOARD-01--FORM',
    ]);
    expect(data.vapiBeatIds).toEqual([]);
    expect(data.mp3BeatIds).toContain('onboarding-beat-3-coach-greeting');
    expect(data.hybridBeatIds).toContain('onboarding-beat-8-morning-checkin-setup');
    const module = renderBeatIdsModule(fixture());
    expect(module).toContain('export const BEAT_IDS');
    expect(module).toContain('export const LEGACY_SCREEN_ID_TO_BEAT_ID');
    expect(module).toContain('export const VAPI_BEAT_IDS');
    expect(module).toContain('export const MP3_BEAT_IDS');
    expect(module).toContain('export const HYBRID_BEAT_IDS');
  });

  it('rejects a crosswalk reference to a nonexistent beat', () => {
    const invalid = readFileSync(fixturePath, 'utf8').replace(
      '"beatId": "onboarding-beat-4-sign-up"',
      '"beatId": "missing"',
    );
    expect(() => parseOnboardingContract(invalid)).toThrow('unknown beat id "missing"');
  });
});

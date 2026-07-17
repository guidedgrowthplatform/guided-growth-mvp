import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  renderAudioManifest,
  verifyAudioManifestAssets,
} from '../../../../scripts/onboarding/lib/generateAudioManifest';
import { parseOnboardingContract } from '../../../../scripts/onboarding/lib/readContract';

const fixture = {
  schemaId: 'guided-growth.onboarding-contract',
  schemaVersion: 1,
  sourceGitSha: 'a'.repeat(40),
  contractRevision: 'fixture-revision',
  globalContext: '',
  toolArgumentSchemas: {},
  variantSelections: [],
  legacyCrosswalk: {
    status: 'transitional-delete-after-migration',
    entries: [{ legacyScreenId: 'ONBOARD-WELCOME', beatId: 'welcome' }],
  },
  renames: { 'legacy-welcome': { beatId: 'welcome', contractSeq: 7 } },
  beats: [
    {
      id: 'welcome',
      name: 'Welcome',
      order: 0,
      path: 'both',
      type: 'screen',
      parent: null,
      advance: { mode: 'manual', gateOwner: null },
      context: '',
      openerSeq: 1,
      allowedTools: [],
      expectedResponse: null,
      voice: {
        engine: 'MP3',
        mode: 'Verbatim',
        perLine: [{ seq: 1, resolution: 'recorded', liveAllowed: false }],
      },
      hideOrb: false,
      props: {},
      elements: [],
      script: [
        {
          seq: 1,
          words: 'Welcome home.',
          bindsTo: { kind: null, element: null, screen: null },
          voice: null,
          clip: 'welcome-home',
          clipPath: 'public/voice/ob/legacy-welcome.wav',
          expectedUser: null,
        },
      ],
      scriptMeta: { reveal: [], timing: [] },
      beatIO: { dataIn: [], dataOut: [] },
      conversation: null,
      acceptanceCriteria: [],
      applicableDecisions: [],
    },
  ],
};

const temporaryRoots: string[] = [];
afterEach(() =>
  temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })),
);
const contract = () => parseOnboardingContract(`${JSON.stringify(fixture, null, 2)}\n`);

describe('renderAudioManifest', () => {
  it('emits beat-keyed canonical paths with exact contract provenance', () => {
    const result = renderAudioManifest(contract());
    const line = result.manifest.beats.welcome.lines[0];

    expect(line).toMatchObject({
      clipId: 'welcome-home',
      lockedText: 'Welcome home.',
      voiceResolution: 'recorded',
      renderWav: {
        canonicalPath: 'public/voice/ob/welcome-home.wav',
        legacyPath: 'public/voice/ob/legacy-welcome.wav',
      },
      appMp3: {
        canonicalPath: 'public/voice/onboarding/welcome-home.mp3',
        legacyPath: 'public/voice/onboarding/ONBOARD-WELCOME.mp3',
      },
    });
    expect(result.manifest.beats.welcome.opener).toEqual(line);
    expect(result.manifest.beats.welcome.contractSeq).toBe(7);
    expect(result.metadata).toEqual({
      contractRevision: 'fixture-revision',
      contractSha256: contract().contractSha256,
    });
  });

  it('uses the latest rename sequence when multiple tombstones resolve to one beat', () => {
    const renamed: any = structuredClone(fixture);
    renamed.renames['older-welcome'] = { beatId: 'welcome', contractSeq: 3 };
    renamed.renames['newer-welcome'] = { beatId: 'welcome', contractSeq: 9 };

    const manifest = renderAudioManifest(
      parseOnboardingContract(`${JSON.stringify(renamed)}\n`),
    ).manifest;

    expect(manifest.beats.welcome.contractSeq).toBe(9);
  });

  it('rejects shared clips with different locked text', () => {
    const invalid: any = structuredClone(fixture);
    invalid.beats.push({
      ...structuredClone(fixture.beats[0]),
      id: 'second',
      name: 'Second',
      order: 1,
      openerSeq: null,
      voice: {
        engine: 'Cartesia',
        mode: 'Verbatim',
        perLine: [{ seq: 1, resolution: 'recorded', liveAllowed: false }],
      },
      script: [{ ...structuredClone(fixture.beats[0].script[0]), words: 'Different words.' }],
    });

    expect(() =>
      renderAudioManifest(parseOnboardingContract(`${JSON.stringify(invalid)}\n`)),
    ).toThrow('shared with incompatible');
  });

  it('requires every declared canonical asset during enforcement', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'audio-manifest-'));
    temporaryRoots.push(root);
    const manifest = renderAudioManifest(contract()).manifest;
    const wav = resolve(root, 'public/voice/ob/welcome-home.wav');
    const mp3 = resolve(root, 'public/voice/onboarding/welcome-home.mp3');
    mkdirSync(resolve(wav, '..'), { recursive: true });
    mkdirSync(resolve(mp3, '..'), { recursive: true });
    writeFileSync(wav, 'wav');

    expect(() => verifyAudioManifestAssets(root, manifest)).toThrow('canonical asset is missing');
    writeFileSync(mp3, 'mp3');
    expect(() => verifyAudioManifestAssets(root, manifest)).not.toThrow();
  });
});

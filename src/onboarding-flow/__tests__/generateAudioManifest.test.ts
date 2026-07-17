import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderAudioManifest } from '../../../scripts/onboarding/lib/generateAudioManifest';
import { parseOnboardingContract } from '../../../scripts/onboarding/lib/readContract';

const fixturePath = resolve(process.cwd(), 'src/onboarding-flow/flows/onboarding-contract.v1.json');
const fixture = () => parseOnboardingContract(readFileSync(fixturePath, 'utf8'));

describe('Phase B onboarding audio manifest', () => {
  it('keys assets by canonical beat and retains required audio details', () => {
    const { manifest, metadata } = renderAudioManifest(fixture());
    expect(Object.keys(manifest.beats)).toEqual(['welcome', 'profile']);
    expect(manifest.beats.welcome.lines.map((line) => line.clipId)).toEqual([
      'welcome',
      'welcome-women',
    ]);
    expect(manifest.beats.welcome.opener).toMatchObject({
      clipId: 'welcome',
      lockedText: 'Welcome to Guided Growth.',
      voiceResolution: 'recorded',
      renderWav: {
        canonicalPath: 'public/voice/ob/welcome.wav',
        legacyPath: 'public/voice/ob/welcome.wav',
      },
      appMp3: {
        canonicalPath: 'public/voice/onboarding/welcome.mp3',
        legacyPath: 'public/voice/onboarding/ONBOARD-WELCOME.mp3',
      },
    });
    expect(manifest.beats.profile.lines).toEqual([
      expect.objectContaining({ clipId: 'path-opener', renderWav: expect.any(Object) }),
    ]);
    expect(manifest.beats.welcome.contractSeq).toBeNull();
    expect(metadata.contractRevision).toBe('phaseb-fixture-v1');
    expect(metadata.contractSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects unsafe legacy paths', () => {
    const invalid = readFileSync(fixturePath, 'utf8').replace(
      'public/voice/ob/welcome.wav',
      '../checkin.wav',
    );
    expect(() => renderAudioManifest(parseOnboardingContract(invalid))).toThrow(
      'unsafe path segment',
    );
  });

  it('rejects a shared clip with incompatible locked text', () => {
    const invalid = readFileSync(fixturePath, 'utf8')
      .replace('"clip": "welcome-women"', '"clip": "welcome"')
      .replace(
        '"words": "Welcome to Guided Growth.",\n          "bindsTo"',
        '"words": "A different welcome.",\n          "bindsTo"',
      );
    expect(() => renderAudioManifest(parseOnboardingContract(invalid))).toThrow(
      'shared with incompatible',
    );
  });
});

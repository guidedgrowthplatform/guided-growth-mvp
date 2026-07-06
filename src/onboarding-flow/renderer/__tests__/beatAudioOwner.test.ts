/**
 * B40: the shared audio-ownership claim so exactly one path ever speaks a
 * given beat. Pure module-level state, no React - see beatAudioOwner.ts for
 * the full contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beatAudioOwnerOf,
  claimBeatAudio,
  isBeatAudioClaimed,
  releaseBeatAudio,
  resetBeatAudioOwnerForTests,
} from '../beatAudioOwner';

describe('beatAudioOwner', () => {
  beforeEach(() => {
    resetBeatAudioOwnerForTests();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    resetBeatAudioOwnerForTests();
  });

  it('the first claimant owns the beat', () => {
    expect(isBeatAudioClaimed('ONBOARD-STATE-CHECK')).toBe(false);
    expect(claimBeatAudio('ONBOARD-STATE-CHECK', 'narration-driver')).toBe(true);
    expect(isBeatAudioClaimed('ONBOARD-STATE-CHECK')).toBe(true);
    expect(beatAudioOwnerOf('ONBOARD-STATE-CHECK')).toBe('narration-driver');
  });

  it('driver claims first -> the legacy opener path is a no-op with a console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(claimBeatAudio('ONBOARD-STATE-CHECK', 'narration-driver')).toBe(true);

    // The legacy MP3 opener races in for the SAME beat (B40's actual shape: a
    // beat transition where the previous beat's opener hadn't settled yet).
    // It must back off entirely - no audio, no ownership change - and it must
    // be loud about it so a regression like this shows up in the logs.
    expect(claimBeatAudio('ONBOARD-STATE-CHECK', 'opener-mp3')).toBe(false);
    expect(beatAudioOwnerOf('ONBOARD-STATE-CHECK')).toBe('narration-driver');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ONBOARD-STATE-CHECK');
    expect(warn.mock.calls[0][0]).toContain('narration-driver');
    expect(warn.mock.calls[0][0]).toContain('opener-mp3');

    // A THIRD path (sendOpener's speech turn) races in too - same result.
    expect(claimBeatAudio('ONBOARD-STATE-CHECK', 'send-opener-speech')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('legacy opener claims first -> the narration driver backs off instead (order-agnostic)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(claimBeatAudio('ONBOARD-BEGINNER-01', 'opener-cartesia')).toBe(true);
    expect(claimBeatAudio('ONBOARD-BEGINNER-01', 'narration-driver')).toBe(false);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-01')).toBe('opener-cartesia');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a repeat claim by the SAME owner succeeds without warning (segments re-arming within one beat)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(claimBeatAudio('ONBOARD-BEGINNER-07', 'narration-driver')).toBe(true);
    // The narration driver re-claims for its next segment (bubble -> reveal ->
    // close): same owner, must succeed silently, not be treated as a conflict.
    expect(claimBeatAudio('ONBOARD-BEGINNER-07', 'narration-driver')).toBe(true);
    expect(claimBeatAudio('ONBOARD-BEGINNER-07', 'narration-driver')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('release on beat exit frees the claim for the next beat (or a retry of this one)', () => {
    claimBeatAudio('ONBOARD-BEGINNER-01', 'opener-mp3');
    expect(isBeatAudioClaimed('ONBOARD-BEGINNER-01')).toBe(true);

    releaseBeatAudio('ONBOARD-BEGINNER-01', 'opener-mp3');
    expect(isBeatAudioClaimed('ONBOARD-BEGINNER-01')).toBe(false);

    // A fresh claimant (the next beat reusing screenId space, or a retry) can
    // now claim cleanly - no stale lock left behind.
    expect(claimBeatAudio('ONBOARD-BEGINNER-01', 'narration-driver')).toBe(true);
  });

  it('release is a no-op unless the caller is the CURRENT owner (a stale release cannot evict the live owner)', () => {
    claimBeatAudio('ONBOARD-BEGINNER-02', 'opener-mp3');
    // A torn-down/superseded instance of a DIFFERENT owner releases late.
    releaseBeatAudio('ONBOARD-BEGINNER-02', 'narration-driver');
    // The real owner's claim must still stand.
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-02')).toBe('opener-mp3');
    expect(isBeatAudioClaimed('ONBOARD-BEGINNER-02')).toBe(true);
  });

  it('componentOwned exclusivity: a component-owned claim blocks every other path on the same beat', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // BeatView claims automatically for componentOwned beats (the greeting,
    // mic-permission) before rendering the adapter alone.
    expect(claimBeatAudio('COACH-GREETING', 'component-owned')).toBe(true);

    // Every other owner racing in for the SAME beat must back off - the
    // component owns its ENTIRE sequence (audio, orb, bubbles, completion).
    expect(claimBeatAudio('COACH-GREETING', 'opener-mp3')).toBe(false);
    expect(claimBeatAudio('COACH-GREETING', 'opener-cartesia')).toBe(false);
    expect(claimBeatAudio('COACH-GREETING', 'narration-driver')).toBe(false);
    expect(claimBeatAudio('COACH-GREETING', 'send-opener-speech')).toBe(false);
    expect(beatAudioOwnerOf('COACH-GREETING')).toBe('component-owned');
    expect(warn).toHaveBeenCalledTimes(4);

    // Once the component-owned beat exits and releases, the beat id is free.
    releaseBeatAudio('COACH-GREETING', 'component-owned');
    expect(claimBeatAudio('COACH-GREETING', 'opener-mp3')).toBe(true);
  });

  it('different beat ids never contend with each other', () => {
    expect(claimBeatAudio('ONBOARD-BEGINNER-01', 'opener-mp3')).toBe(true);
    expect(claimBeatAudio('ONBOARD-BEGINNER-02', 'opener-cartesia')).toBe(true);
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-01')).toBe('opener-mp3');
    expect(beatAudioOwnerOf('ONBOARD-BEGINNER-02')).toBe('opener-cartesia');
  });
});

/**
 * useBeatAudioHold - B58: holds a beat's audio claim for a whole lifetime
 * (e.g. a multi-segment narration script), not just one clip's settle.
 *
 * Per-clip hooks like useBeatOpenerMp3 release at every settle, which leaves
 * the beat unclaimed during inter-segment gaps (breaths, clip-less dwells) -
 * a window another speaker (chat TTS) can grab. This hook claims once while
 * `active` and releases once on deactivation/unmount, independent of how many
 * clips play underneath it. Claim result is ignored: a same-owner repeat is
 * silent, and release() is a no-op unless this owner still holds the claim.
 */
import { useEffect } from 'react';
import { type BeatAudioOwnerKind, claimBeatAudio, releaseBeatAudio } from './beatAudioOwner';

export function useBeatAudioHold(
  beatId: string | null,
  owner: BeatAudioOwnerKind,
  active: boolean,
): void {
  useEffect(() => {
    if (!active || !beatId) return;
    claimBeatAudio(beatId, owner);
    return () => releaseBeatAudio(beatId, owner);
  }, [active, beatId, owner]);
}

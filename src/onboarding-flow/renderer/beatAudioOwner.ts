/**
 * beatAudioOwner — B40: a single, shared claim so exactly one audio path ever
 * speaks a given beat.
 *
 * Before this module, a beat's audio could be started by more than one path
 * with no shared lock between them:
 *   - the narration driver (NarrationBeatView, via useBeatOpenerMp3)
 *   - the legacy per-beat opener hooks in BeatView (useBeatOpenerCartesia /
 *     useBeatOpenerMp3, gated off for narration/componentOwned beats but not
 *     coordinated with anything else)
 *   - useOnboardingChat's fireOrDeferOpener -> llm.sendOpener(), which can
 *     also speak (TTS chunking, engineForTurn's speakReplies) independent of
 *     which opener hook the beat's view chose
 *
 * BeatView already avoids some of this by branching on hasNarration /
 * componentOwned before deciding which hook to mount, but that is a render
 * order argument, not a shared runtime lock: a beat transition (the previous
 * beat's audio still draining) or a future regression that adds a fourth
 * speaker has no mechanism to detect or prevent a double-arm. This registry
 * is that mechanism: the first claimant for a beat id owns its audio for the
 * lifetime of the claim; every later claimant while the claim is held gets a
 * no-op (false) plus a console.warn, so a double-arm screams in the logs
 * instead of playing two clips over each other.
 *
 * Usage: a speaker calls claim(beatId, owner) right before it starts audio.
 * true means proceed; false means back off (something else already owns this
 * beat's audio). The owner MUST call release(beatId, owner) when its audio
 * ends or the beat exits, so the next beat (or a retry) can claim cleanly.
 * release() is idempotent and a no-op unless the caller is the current owner
 * (a stale release from a torn-down instance can't evict the live owner).
 *
 * Pure module-level state (no React) so it is trivially unit-testable and so
 * it works the same whether the claimant is a hook, the narration driver, or
 * a one-shot speak() call outside the render tree.
 */

export type BeatAudioOwnerKind =
  | 'narration-driver'
  | 'opener-cartesia'
  | 'opener-mp3'
  | 'send-opener-speech'
  | 'component-owned';

interface Claim {
  owner: BeatAudioOwnerKind;
  /** Monotonic, for logging only. */
  id: number;
}

const claims = new Map<string, Claim>();
let nextClaimId = 1;

/**
 * Claim a beat's audio for `owner`. Returns true if the claim succeeded (no
 * other owner currently holds this beat), false if it was already held by a
 * DIFFERENT owner (a no-op for the caller: do not start audio). A repeat
 * claim by the SAME owner (e.g. a hook re-arming on a dep change) is allowed
 * and simply refreshes nothing — it returns true, since the caller already
 * owns the beat.
 */
export function claimBeatAudio(beatId: string, owner: BeatAudioOwnerKind): boolean {
  const existing = claims.get(beatId);
  if (!existing) {
    claims.set(beatId, { owner, id: nextClaimId++ });
    return true;
  }
  if (existing.owner === owner) return true;
  // eslint-disable-next-line no-console
  console.warn(
    `[beatAudioOwner] "${beatId}" audio already owned by "${existing.owner}"; "${owner}" backed off (no-op). This means two audio paths armed for the same beat - a B40 regression.`,
  );
  return false;
}

/**
 * Release a beat's audio claim. No-op unless `owner` is the CURRENT owner
 * (a stale release from a torn-down/superseded instance can't evict the
 * live owner's claim).
 */
export function releaseBeatAudio(beatId: string, owner: BeatAudioOwnerKind): void {
  const existing = claims.get(beatId);
  if (!existing || existing.owner !== owner) return;
  claims.delete(beatId);
}

/** True if `beatId` currently has any claim (any owner). Test/debug only. */
export function isBeatAudioClaimed(beatId: string): boolean {
  return claims.has(beatId);
}

/** Current owner of `beatId`'s audio, or null. Test/debug only. */
export function beatAudioOwnerOf(beatId: string): BeatAudioOwnerKind | null {
  return claims.get(beatId)?.owner ?? null;
}

/** Clear every claim. Tests only - production code never needs a global reset. */
export function resetBeatAudioOwnerForTests(): void {
  claims.clear();
}

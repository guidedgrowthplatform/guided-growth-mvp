# Fix report — Loop 1: no coach audio + playback hardening (B3, B4, B14, B15)

Branch `bugfix-loop1-audio`, MR !397. Status: B3 and B15 preview-verified
2026-07-02 (signed-in batch). B4 REWORKED 2026-07-02 after the signed-in
verification found the first fix defeated by a double-activation race (see
"B4 rework" below); temp diagnostics dae9bf1c reverted (354e0f79).

## B3 — Cartesia opener silent while captions render

**Root cause (verified in code, not guessed):** the flow renderer had NO player
for `voiceOut.engine === 'cartesia'` beats. `speakOpener()` (the only Cartesia
opener player) runs solely on the env-gated Vapi instant-opener path
(`ONBOARDING_INSTANT_OPENER && isVapiCapableBeat`), and the generated flow has
zero vapi-brained beats — so on ONBOARD-01--FORM (the name-greeting beat, the
only cartesia-engine beat, confirmed against the flow-annotated-render oracle)
the karaoke ran its fixed-cadence fallback timer over silence. Captions
word-by-word, no sound — exactly the reported symptom.

**Fix:** `useBeatOpenerCartesia` (new) wraps `speakOpener` with the same state
shape as `useBeatOpenerMp3`; `BeatView` routes both engines through the same
audio-driven karaoke. QA mute wiring and gesture fallback included.

**Upstream prevention:** `openerAssets.test.ts` fails if the builder emits a
cartesia beat with no opener text, or any engine value the runtime doesn't
implement. A regenerated flow that the runtime cannot voice now fails CI
instead of shipping silence.

## B4 — MP3 clips don't play

Two distinct facets:

1. **Autoplay rejection** (root cause for silent-with-no-error runs): a refresh
   landing directly on a beat has no user-gesture activation; `el.play()`
   rejects `NotAllowedError` and the hook settled into a silent beat by design.
   **Fix:** reuse `attempt-play-with-gesture-fallback` — playback defers to the
   next pointer/key gesture instead of dying.
2. **Dead air + long LLM think after the path answer:** NOT a playback bug. A
   tap advances the engine locally and instantly; a voice/LLM answer advances
   only after the LLM tool dispatch writes `current_step` (watched via
   realtime). When those LLM calls stall/fail (B11) there is no advance and so
   no next-beat MP3. Cross-filed: the stall is Loop 3 (B11), the missing
   beat-completion wiring is Loop 2 (B20).

**Upstream prevention:** the same `openerAssets.test.ts` verifies every
mp3-engine beat's clip file exists in `public/` (against the generated flow, so
`flow:sync` regressions are caught), killing the silent-404 class.

### B4 rework (2026-07-02): the double-activation settle race

**Verified failure (signed-in preview batch, evidence /tmp/gg-verify/):** every
`useBeatOpenerMp3` beat activates TWICE (React strict-mode style double effect
or a dep-change re-run). Activation #1's cleanup pause()s the SHARED preloaded
element from `openerPreloadPool`; the pause makes its pending play() reject
with AbortError. That rejection belongs to activation #1 but lands after
activation #2 armed and reset the shared `settledRef`, so the shared settle
path marked activation #2 done. Net effect: zero onboarding MP3s ever reached
a `playing` event on authed and preview routes, autoplay allowed or blocked;
say-only beats flashed by silently (settle sets progress=1, the karaoke
completes instantly, AutoAdvance fires).

**Fix (commit 36963b50):**

1. `openerActivation.ts` (new, pure): per-activation settle tokens. Each
   effect run begins its own activation on a tracker; `settle()` returns true
   (perform side effects) only for the current, un-settled activation. A stale
   activation records itself settled but can never settle, or touch the audio
   of, the current one. `classifyOpenerPlayFailure` encodes the failure rules
   (settled/stale/teardown: ignore; AbortError on the live activation: retry;
   anything else: settle by failure).
2. AbortError on the live activation RE-ARMS play() (bounded, 2 retries)
   instead of settling the beat done-with-no-audio.
3. `openerPreloadPool.claimPreloadedClip`/`release`: the warm element is handed
   to one consumer at a time; a concurrent consumer falls back to a fresh
   element, so two activations can never abort each other's pending play().
4. `BeatView`: while opener audio is armed but not yet started (buffering or
   holding for the autoplay-unlock gesture) the karaoke word count pins to 0,
   so the card reveal waits for real audio instead of running the silent
   fallback cadence. BeatPlayer's 12s VOICE_REVEAL_MAX_MS safety still
   un-strands the beat if audio never starts.

**Contracts preserved:** done-after-playing vs done-by-failure, defer-to-
gesture on NotAllowedError (B4 facet 1), progress/karaoke via
currentTime/duration, cleanup on unmount stops and rewinds audio. One quiet
console.warn per failed clip (the unconditional TEMP diagnostics are gone).

**Upstream prevention:** `openerActivation.test.ts` locks the token + classify
rules and the pool claim serialization; `useBeatOpenerMp3.race.test.tsx`
renders the hook under StrictMode with a controllable Audio stub and fails if
the late AbortError ever settles the live activation again (fresh and pooled
element shapes), plus re-arm, NotAllowed hold-then-gesture, terminal failure,
and cleanup coverage.

## B15 — clips not pre-buffered

**Root cause:** `useBeatOpenerMp3` created the Audio element at beat
activation with `preload='auto'` — reactive; playback start rode the network.
No prior preload art existed anywhere in history (docs/prior-fixes/).

**Fix:** `openerPreloadPool` warms all mp3 opener clips at flow mount
(3-at-a-time, keyed by src); the hook plays the pooled element (buffered data
kept; finite `duration` preserved for karaoke, unlike blob URLs which Chrome
reports as Infinity).

## B14 — first spoken word cut off at clip start

**Root cause:** playback started immediately on activation regardless of
buffer state; a cold buffer clips the first word.

**Fix:** first play gates on the pool's `canplaythrough` with a 2.5s bound (a
stalled preload can't dead-end the beat).

**Note:** the USER-first-word STT variant of this symptom is already solved on
`feat/onboarding-voice-track1` (commits 8de9b66 + beed650, unmerged) — see
docs/prior-fixes/first-word-cutoff.md. That transfer belongs to Loop 5.

## Verification

Post-rework (2026-07-02, commit 36963b50):

- `npx tsc --noEmit` clean; 1365/1365 vitest pass (132 files) including the 18
  new race tests (`openerActivation.test.ts` + `useBeatOpenerMp3.race.test.tsx`).
- Local dev (vite :5323) Playwright walker over
  `/onboarding-flow-preview?startAt=why-intro`, evidence
  /tmp/gg-verify/loop1-fix-*.json (script: loop1-fix-walker.mjs):
  - Autoplay ALLOWED: 6 MP3 beats walked (why-intro, state-check,
    morning-setup, reflection-setup, path-fork, category); every clip fired
    `playing` before the next beat armed, every clip `ended`, no clip ended
    without playing, every strict-mode AbortError recovered into playback.
    16/16 checks PASS.
  - Autoplay BLOCKED (refresh landing on why-intro with zero user activation):
    beat HOLDS hands-off for the 8s window (no playing, no ended, no advance),
    then a trusted tap starts playback, the clip plays to the end, and the
    flow advances to state-check. 6/6 checks PASS.
- Deployed preview (signed OUT, auth-free route): same two walker runs against
  the CI preview URL, results recorded in the STATUS.md worklog.

Earlier signed-in batch (pre-rework evidence that defined B4's rework): B3 and
B15 PASS on gg-5h6ohbzcn, B4 FAIL with the double-activation race, B14 blocked
behind B4 (clips never started). B14's canplaythrough gate is unchanged by the
rework and becomes verifiable again now that clips play.

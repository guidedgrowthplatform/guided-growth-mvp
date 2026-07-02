# Fix report — Loop 1: no coach audio + playback hardening (B3, B4, B14, B15)

Branch `bugfix-loop1-audio`, MR !397. Status: fixes implemented + unit-tested;
**preview verification pending** (see Verification).

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

- `npx tsc --noEmit` clean; 1347/1347 vitest pass (130 files) including the new
  parity test.
- Preview-deploy verification (fresh run + mid-flow-refresh run, every opener
  clip audible, first word complete, Slow-3G start-latency check) is
  **blocked**: preview URLs sit behind Vercel SSO, and the operator's Chrome
  extension (the authenticated browser) is currently unresponsive. Loop stays
  open until this passes; temp diagnostics stay in until then.

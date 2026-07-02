# Prior fix: mic arming / keep-warm around voice playback (B16)

## Verdict: complete, tested implementation exists — on an UNMERGED branch

`feat/onboarding-voice-track1` (2026-07-01, NOT in origin/staging) implements the
whole Loop 5 pattern against the **Soniox** voice-in path:

- **8de9b66 (T1-1)**: persistent mic session. `booted` (AudioContext + getUserMedia
  alive) split from `wantSockets` (paid socket open); `setArmed(on)` toggles capture
  without teardown; provider drives it via `holdMic` prop
  (`voiceInHoldMic = VOICE_IN_ENABLED && micOn && inOnboarding && engine !== 'vapi'`).
- **beed650 (T1-2/T1-3)**: mic held closed while an opener MP3 plays
  (`useOpenerPlaybackStore.playing` → `responding` gate), opened exactly on the clip
  `ended` event; on release `prebuf.drain()` + VAD reset for a clean first word;
  prebuffer 2.0s covers VAD sustain + socket connect.
- Tests: `soniox-stream-recovery.test.tsx` covers setArmed keep-alive and
  setResponding release with no getUserMedia re-boot.

## Staging baseline (for contrast)

`origin/staging:src/contexts/OnboardingVoiceProvider.tsx` is Vapi-centric:
`maybeOpenMic()` unmutes only when `openerDoneRef && vapiJoinedRef`;
`OPENER_FAILSAFE_MS = 10000` failsafe; `startAudioOff: true` on every call.
No duration-based pre-arm, no keep-warm across beats.

## Transfer plan for Loop 5

Stack on / merge `feat/onboarding-voice-track1` instead of reimplementing (1)–(3)
of the loop spec. Remaining NEW work on top:

1. `durationMs` on the mp3Assets shape (types + designer-source + transform) as the
   pre-arm hint — not present in the track1 work (it keys purely on `ended`).
2. Failure guard: distinguish done-after-playing from done-by-failure in
   `useBeatOpenerMp3` — track1 sets `setOpenerPlaying(false)` on settle regardless
   of cause, which would open the mic over silence on a failed clip (exactly what
   Loop 5 forbids). This gap must be closed.

Caveats: main checkout sits on that branch with 3 uncommitted files (coordinate
with Yonas); pre-579023d3 history has no mic-arming prior art (old onboarding was
Vapi-only).

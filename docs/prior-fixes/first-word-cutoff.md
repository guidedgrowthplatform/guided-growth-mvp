# Prior fix: first spoken word cut off at clip start (B14)

## Verdict: partial prior fix — on an UNMERGED branch; symptom split matters

The symptom has two distinct readings; history covers one of them.

### 1. USER's first word clipped when the mic opens — SOLVED, not merged

Commits on `feat/onboarding-voice-track1` (2026-07-01, NOT in origin/staging):

- **8de9b66** "keep Soniox mic warm across beats (T1-1)" — splits `armed` into
  `booted` (mic graph alive) vs `wantSockets` (accept speech); per-beat disarm no
  longer tears down getUserMedia/AudioContext. `soniox-stream.ts`, `useVoiceInCapture.ts`,
  `OnboardingVoiceProvider.tsx`.
- **beed650** "open mic at clip end + protect first word (T1-2/T1-3)" —
  - `PREBUFFER_MAX_SAMPLES` 24000 → 32000 (1.5s → 2.0s @16k): "Covers VAD sustain +
    socket connect so the first token isn't clipped (T1-2)."
  - `useOpenerPlaybackStore` in `useBeatOpenerMp3.ts` publishes MP3-playing state;
    provider extends the `responding` gate with it (mic held closed during clip).
  - On `setResponding(false)` release: `prebuf.drain(); vad = emptyVadState();` —
    "drop the buffered echo tail so the user's turn opens on their first word (T1-3)."
  - Test: `soniox-stream-recovery.test.tsx` "keeps the mic warm — no teardown".

**Transfer**: already written against `src/onboarding-flow/renderer/useBeatOpenerMp3.ts`.
Loops 1/5 should merge/stack on `feat/onboarding-voice-track1` (or cherry-pick
8de9b66 + beed650) rather than reimplement. Caveat: the main checkout has 3
uncommitted files on that branch — coordinate with Yonas before assuming branch tip
is final.

### 2. COACH clip's first word clipped at playback start — no direct prior fix

- Searches (grep + pickaxe: cutoff, first word, clipped, truncat, padding, prime,
  playbackRate, currentTime) found nothing targeting playback-start truncation.
- Pre-579023d3 page-based onboarding had NO static-MP3 player (Vapi/Cartesia only) —
  nothing to mine there.
- Tangential: **fa04c67** (2026-06-30) adds `estimatedDurationMs` fallback in
  `speakOpener()` for Chrome's `duration === Infinity` on blob MP3 — karaoke pacing,
  not truncation, but relevant if instrumenting Cartesia opener timing.

**Conclusion for Loop 1**: if repro shows the COACH clip's own first word missing,
solve fresh — likely `canplaythrough` gating + AudioContext/gesture priming (reuse
`src/lib/audio/attempt-play-with-gesture-fallback.ts`). If repro shows the USER's
word clipped, the fix already exists on the track1 branch.

# Track 1 (Voice + Audio) — Yonas's in-depth work plan

Date: 2026-07-01
Branch: `feat/onboarding-voice-track1` (off Yair's `feat/onboarding-metadata-engine`).
Scope: Workstream A only (voice-in Soniox + voice-out MP3/Cartesia timing). Everything from "coach speaks" to "we have the user's words." Does NOT touch `/api/llm`, the tool registry, or the coach — that's Mint's Track 2.
Pairs with: `docs/onboarding-voice-engine-plan-2026-07-01.md` (the shared foundation plan).

## Seam contract with Track 2 (agree first, never cross)

- Track 1 owns: mic lifecycle, MP3/Cartesia playback + timing, and producing the **transcript + "user finished this turn" signal**.
- Track 2 owns: reading that transcript → coach → tool call → card fill/persist.
- The ONE shared file is `OnboardingVoiceProvider`. Track 1 owns its audio lifecycle; Track 2 only reads the transcript at the hand-off. Do not edit `/api/llm`, `buildSystemPrompt`, tool handlers, or `beatContexts`.

---

## What Yair already shipped (verify, don't rebuild)

- 18 MP3 clips in `public/voice/onboarding/`, wired as `node.meta.voiceOut.mp3Assets[0].file`.
- Playback + karaoke caption: `useBeatOpenerMp3.ts` → progress fraction → word reveal in `BeatView.tsx:94-98` / `BeatPlayer.tsx`.
- Live-Cartesia name beat: `speakOpener.ts` + `applyName.ts`; profile classified `cartesia` in `designerToFlow.ts:598-604`.

---

## The real Track-1 work

### T1-1 — Keep the mic warm across beats (Bug B / A2) [biggest item]

Problem: `useVoiceInCapture.ts:112-177` starts a full Soniox session (getUserMedia + AudioContext + WebSocket) on beat mount and `handle.stop()` on unmount. Every beat is a cold mic start. The stream is never reused across beats.
Approach:

- Lift the Soniox session lifecycle out of the per-beat hook into a single persistent session owned by `OnboardingVoiceProvider`, created once at mic-permission grant and kept alive for the whole onboarding flow.
- Per-beat code only toggles "this beat wants voice-in" (arm/disarm the socket-open gate), it does NOT tear down getUserMedia/AudioContext.
- iOS caveat: NSMicrophoneUsageDescription already handled by `scripts/patch-ios-plist.mjs`.
  Files: `OnboardingVoiceProvider.tsx`, `useVoiceInCapture.ts`, `soniox-stream.ts` (expose a persistent-session API: boot once, arm/disarm per beat).
  Done: walking beat→beat re-uses one getUserMedia stream; no AudioContext churn in the console per beat.

### T1-2 — Kill the first-word cutoff (Bug A / A3)

Problem: post-TTS `MIC_GRACE_MS=2500` (`OnboardingVoiceProvider.tsx:132`) + `VAD_OPEN_SUSTAIN_MS=150` (`soniox-stream.ts:509`) delay socket open, while `PREBUFFER_MAX_SAMPLES=24000` = only 1.5s (`soniox-stream.ts:504`). If the user starts speaking late in the grace window, the leading edge ("44"→"4") falls off the front of the 1.5s ring buffer.
Approach (pick after measuring on a phone — the dev-sync also suspects raw-Soniox quality):

- Make prebuffer ≥ grace: raise `PREBUFFER_MAX_SAMPLES` to cover grace+sustain (≥ ~2.7s → ~44000 samples), so nothing is dropped, OR
- On MP3 beats (known clip end), drop the post-TTS grace entirely and open the socket at clip end (ties to T1-3). Echo risk is low because playback has stopped.
- Keep VAD sustain but ensure prebuffer drains fully on socket 'listening' (`soniox-stream.ts:642-645` already drains — confirm it isn't bounded below grace).
  Files: `soniox-stream.ts`, `OnboardingVoiceProvider.tsx`.
  Done: speaking "I'm 44 and male" the instant a beat's clip ends transcribes the full first token.

### T1-3 — Open the mic at the MP3's end via known duration (A5)

Problem: `useBeatOpenerMp3.ts:155` `el.onended` only settles the caption; nothing signals the mic. Mic arming is on `armOnBeatLoad`, not clip end — so the mic can go hot while the coach is still talking (echo) or too late.
Approach: on `mp3.done` (real `ended` event, duration known), emit the "open socket now" signal to the persistent Soniox session from T1-1, and drop the grace on that transition. This is the precise arm signal that removes the race.
Files: `useBeatOpenerMp3.ts` (surface a done callback), `OnboardingVoiceProvider.tsx` (consume it → arm), `BeatView.tsx` (wiring).
Done: mic opens at the instant the clip stops, not before, not a beat late.

### T1-4 — Orb defaults to both halves on (open item #3)

Problem: default orb is `voice_out_only` (`snapshot.ts:32-34`; `micPermission:false` initially). After grant, the routed-screen path in `engineForTurn.ts:65-72` needs both orbs on for Soniox; today toggling is a no-op on the direct path. The user's model is "Soniox always on unless turned off."
Approach: once mic permission is granted, default the onboarding orb to both-halves-on so `engineForTurn` returns `micSource:'soniox'` on beat load. Verify the orb toggle actually flips voice-in on the direct-LLM path.
Files: `snapshot.ts` / preferences defaults, `engineForTurn.ts`, orb state wiring.
Done: on a fresh onboarding after mic grant, Soniox is listening the instant each interactive beat loads.

### T1-5 — Verification passes (A1/A4/A6, mostly done)

- A1: every one of the 18 beats plays its clip on a fresh walkthrough (no 404, correct file per beat).
- A4: `unlockTTS()` on mic grant so the first clip autoplays without a gesture wall; karaoke tracks each clip.
- A6: profile beat speaks the real name via live Cartesia; the static opener substitutes `{name}` (the coach reply echoing literal `{name}` is Track 2 / `beatContexts`, NOT here — hand to Mint).

---

## Hygiene / blockers found (flag to Yair, fix before consolidation)

1. **`node_modules` is committed as a symlink** to `/Users/yairamsel/Developer/ggmvp-unified/node_modules` on `feat/onboarding-metadata-engine` AND `staging` (`git ls-tree ... node_modules` → mode 120000). Breaks checkout/build for everyone; worked around locally with skip-worktree. Needs removing from the branch + `.gitignore`.
2. **Duplicated MP3 manifest**: `ONBOARDING_BEAT_MP3S` exists in both `useBeatOpenerMp3.ts:43-65` and `designerToFlow.ts:466-486`. Single-source it (transform should be the only owner; metadata `mp3Assets` is the runtime read).

## Status (2026-07-01)

- **T1-1 — DONE.** `setArmed()` in `soniox-stream.ts`; mic boots once at grant, warm across beats. Test in `soniox-stream-recovery.test.tsx`.
- **T1-2 — DONE.** Prebuffer 1.5s→2.0s; echo tail dropped on clip-end release.
- **T1-3 — DONE.** `useOpenerPlaybackStore` holds the socket closed during the opener clip, opens clean at clip end. (Judgment call: onboarding openers override global `FULL_DUPLEX_BARGE_IN`; confirm no-barge-in-during-opener is intended.)
- **T1-4 — SATISFIED (not new code).** Defaults (`voiceMode:'voice'` + `micEnabled:true`) already give both-on after grant; T1-1 made the toggle effective; `onChatPage` resolves both-on → Direct-LLM + Soniox. Locked by `src/lib/orb/engineForTurn.test.ts` (9 tests).
- **T1-5 — PENDING device test.** Needs a real phone on the QA build; blocked while local voice-out is silent (environmental: tab/system mute, autoplay, or QA sound pill — not a code path issue; runtime mp3Assets paths all resolve to existing files).

Open (team decisions, not done): the `node_modules` symlink and the duplicated `ONBOARDING_BEAT_MP3S` (one is a membership check in `useBeatOpenerMp3.ts`, one is build-time in `designerToFlow.ts`; neither drives runtime playback). Also the Cartesia name beat still runs full-duplex.

## Order of execution

1. T1-1 (persistent mic session) — foundation for T1-2/T1-3.
2. T1-3 (arm at clip end) + T1-2 (prebuffer/grace) together — same subsystem.
3. T1-4 (orb default).
4. T1-5 verification pass on a fresh onboarding walkthrough.
5. Hygiene items + consolidate to staging.

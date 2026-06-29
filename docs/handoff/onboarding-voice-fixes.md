# Onboarding voice fixes — handoff (Yonas)

**Branch:** `fix/onboarding-voice-render-toolcalls` (off `staging`) · **Owner:** Yonas
Working the post-demo fix list. Beat order/content untouched (waiting on Yair's new flow + Flow Builder review). Commit/push ~every 1–2h; entries below newest-first.

---

## 2026-06-30 — #3 word-by-word first beat + #5 card-render diagnosis

**State:** type-check clean, full suite green (1304, exit 0).

### #3 — Cold opener rendered "filled" instead of word-by-word — FIXED

- **Root cause:** Cartesia returns **MP3** (`api/cartesia-tts.ts`: `container:'mp3'`, `audio/mpeg`). Chrome reports `HTMLAudioElement.duration === Infinity` for blob-sourced MP3, so `speakOpener`'s progress tick (`Number.isFinite(d)` guard) never fired mid-playback → `openerReveal.revealedWords` stayed 0 (bubble held by `coldOpenerPending`), then snapped to the full count at `handle.done` → the whole line appeared at once.
- **Fix:** `src/lib/voice/speakOpener.ts` — added an `estimatedDurationMs` fallback: when duration isn't finite, estimate progress from `audio.currentTime` (capped at 0.97 so it only completes on the real `onended`). `OnboardingVoiceProvider.tsx` passes `max(1200, words*310)` (~310ms/word). Real `currentTime/duration` still wins when the browser reports it. Now reveals word-by-word like the rest.
- **Can't unit-test (voice).** Needs a live mic-pass: first beat (profile) cold opener should grow word-by-word in sync with the Cartesia audio.

### #5 — Inconsistent category-card render — DIAGNOSED (engine-timing) + minimal fix

- **Verdict: engine TIMING, not prompt/context.** The interactive card was gated behind `openerPresent` (`BeatPlayer.tsx` `BeatConversation`): the card only rendered once the opener _message_ landed (cold append / warm Vapi STT) or a 12s fallback fired. So whether the card showed depended on opener/message timing vs the navigate→Realtime→advance cycle — if the coach was slow to speak the opener or the beat advanced first, the card was hidden. Nothing to do with the beat copy.
- **Fix:** `BeatPlayer.tsx` — on the **active** beat, render the card as soon as the beat is live (`active || openerPresent`); the opener still karaokes above it when it arrives. Past beats unchanged (still require the opener so the frozen receipt sits under it).
- **Note for the flow rework:** this rendering area will be touched by the new beat order; the fix is presentation-only and beat-agnostic.

### What's next

- **#4 duplicate tool calls** (profile submitted several times, "delete-data") — in progress. Backend dedup (`migration 053_vapi_tool_dedup`) is keyed on Vapi `tool_call_id` (robust per call-id), and there is **no `delete_data` tool** in `dispatch.ts` — so duplicates are most likely _prompt-driven repeats_ (same logical action, different call-ids) and the "delete" is probably `remove_habit` or a QA reset path. Needs a live Vapi call-log trace (`/call?assistantId=…` with `VAPI_PRIVATE_KEY`, read tool calls) to pin client-refire vs prompt-repeat before changing anything.
- Blocked: #2 beat-context modifiers (need Yair's proposal doc — not in repo), new beat order (Flow Builder review first).

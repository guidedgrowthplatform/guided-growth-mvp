# Onboarding chat-native voice — handoff (2026-06-24)

## What we're working on

The chat-native onboarding page (`/onboarding`, `OnboardingChatPage`) running full-duplex
voice like the home check-in coach: **Soniox (voice-in) + Cartesia (voice-out) + Direct
LLM**, no Vapi. Goal: give profile info by voice → coach replies live → card fills →
advance to the fork, without the conversation cancelling or going silent.

## Fixes landed this session (all `tsc` clean, tests green)

1. **Silent reply** — `useOnboardingChat.ts`: assistant bubble was deferred until the
   Cartesia ws drained; a stalled turn hung it forever. Added a playback-idle settle that
   lands the bubble anyway.
2. **`tool_cap_reached`** — `buildSystemPrompt.ts` (`renderBeatToolsBlock`): coach was told
   to chain `advance_step` after every data tool; a missing field made it retry to the
   5-round cap. Now it only chains when required fields are present and asks instead of
   retrying.
3. **Beat oscillation** — `useOnboardingRealtimeSync.ts`: a data-only Realtime write
   (newer `updated_at`, stale `current_step`/`path`) was overwriting the optimistic step,
   rewinding the beat and re-firing the opener. Now clamps `Math.max(current_step)` and
   `next.path ?? prev.path`.
4. **Saves nothing on bad age** — `submitProfile.ts`: a non-numeric age (garbled speech)
   rejected the WHOLE save, dropping nickname too. Now nickname is the only hard field;
   malformed optionals are skipped with a `notes` line for the coach to re-ask. Tests updated.

## Last bug + fix (the one to verify first)

**Soniox hearing anything cancelled the LLM call.** Every Soniox event (incl. the coach's
own TTS echo into the hot mic) → `interruptCoach()` → `llm.cancel()`, with no recovery, so
the reply stayed dead.

**Fix** (ported from `useCoachChat` exactly): `OnboardingVoiceProvider.tsx` +
`useOnboardingChat.ts` — added `owesResponseRef` + a settle check in `flushUtterance` that
**regenerates** the interrupted reply when the buffer is empty (echo/noise, no real turn),
plus `bargeInterrupt()` that always arms a settle timer. Exposed `regenerate()` from
`useOnboardingChat`. Real barge-in still interrupts; echo-cancels now self-heal.

## Verify next

- Live full-duplex run: give profile info by voice, confirm coach replies, card fills, beat
  advances and stays. Watch the browser console `[tool-dispatch]` line to confirm
  `submit_profile` is actually called and `ok`.
- If it still cuts out: re-enable Soniox `responding` suppression during TTS (make the mic
  deaf to the coach's own voice) — the deeper echo fix.

## Known-open (not blocking)

- `suppressTrailingRef` drops a reply on any turn that also advances the beat (latent).
- No client rehydration of the chat thread on refresh (`EMPTY_INITIAL_MESSAGES`).

## Heads-up

`buildSystemPrompt.ts`, `preconditions.ts`, `handlers.test.ts` are part of the uncommitted
beat-context migration — coordinate with whoever owns it before committing.

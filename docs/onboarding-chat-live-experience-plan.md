# Onboarding chat — live experience plan

_Planned 2026-06-28 (Yonas). PLAN ONLY — sensitive surface, do not implement before sign-off._
_Inspiration: `feat/onboarding-chat-vapi-fullduplex` (0d59550). Target surface: the flow
engine at `/onboarding/flow` (FlowRenderer/BeatPlayer), NOT the old OnboardingChatPage._

## The experience we want

Onboarding chat should feel **live**, not pre-rendered:
- **Opener is spoken, rigid, not static text.** The verbatim beat opener is SPOKEN (not
  printed and left there). Cartesia speaks it instantly to mask Vapi's 7–18s cold-start
  while Vapi connects silent; the bubble reveals word-by-word synced to that audio. Rigid =
  the authored opener verbatim, never LLM-improvised.
- **User's words render live** as a blue bubble (partial → final), held as ONE bubble per
  uninterrupted utterance — not dropped ("taken out").
- **Coach replies stream live**, word-by-word, ONE bubble per uninterrupted utterance.
- **Loading/thinking states**: a typing indicator while Vapi is connecting, while the coach
  is about to reply, and while a tool call is in flight. Today there are none.
- **Everything rendered comes from Vapi/LLM live** — the only authored-and-rigid thing is
  the opener (spoken by Cartesia). No static pre-rendered coach text.

### Reconciliation (important)
The full-duplex branch (0d59550) **removed** the Cartesia instant-opener and went pure-Vapi.
We do NOT copy that — `onboarding-cutover` already has the instant-opener (`speakOpener`,
`ONBOARDING_INSTANT_OPENER`), which is exactly the latency-masking you want. **Target =
full-duplex's live-bubble + loading patterns, ON TOP OF our existing instant-opener.**

## Current reality (grounded)

| Piece | Today | File |
|---|---|---|
| Opener | text BeatStep; karaoke synced to speech ONLY on Vapi beats, else fixed 110ms/word timer | `renderer/BeatView.tsx:42-51`, `BeatPlayer.tsx:112-160` |
| Instant opener | Cartesia speaks verbatim opener, Vapi silent — but ONLY first cold-start beat in `CHAT_VAPI_BEAT_SCREENS` | `OnboardingVoiceProvider.tsx:839,878` |
| Coach bubble | karaoke reveal + one-bubble-per-turn merge (good) | `useCoachSpeechReveal.ts`, `OnboardingVoiceProvider.tsx:779-790` |
| User bubble | `LiveUserBubble` partial→final, but **cleared too early** if user keeps talking | `BeatPlayer.tsx:80-102` |
| Loading states | **none** (no connecting spinner, no thinking dots, no tool-call feedback) | — |
| Live coverage | only `CHAT_VAPI_BEAT_SCREENS` = profile, fork (+ category/goals armed) | `onboardingStepBeats.ts:20-23` |

Root cause of "pre-rendered" feel: **live voice only covers profile→fork.** Every other
beat is text-only with the fixed-timer karaoke. The unification (beat-context now feeds Vapi
for ALL beats) makes it safe to widen coverage.

## Plan — phased, each its own commit, gated by a live mic pass

### Phase 0 — Widen live coverage to all onboarding beats
- Extend `CHAT_VAPI_BEAT_SCREENS` from {profile, fork} to every flow onboarding beat, so the
  opener is spoken + karaoke is audio-synced everywhere (not just the first two).
- Safe now: the unified bundle gives every beat correct context + machinery (allowed tools,
  navigate_next target). Validate beat-by-beat on a mic pass.
- Risk: more Vapi turns → cost + idle/teardown (ties to Milestone 3). Gate behind the live pass.

### Phase 1 — Opener goes live + rigid (kill the static pre-render)
- Cold-start beat: keep the Cartesia instant-opener (rigid verbatim `beat.opener`), Vapi
  silent (`silentFirstMessage`). Warm beats: Vapi already connected → it speaks the opener.
- Drive the opener BeatStep reveal ALWAYS off the speech signal (`useCoachSpeechReveal`
  word/window), never the fixed-timer fallback, on covered beats. No static opener text sitting
  un-spoken.
- DECISION (rigidity): either Cartesia speaks EVERY beat's opener (fully rigid, more Cartesia
  cost) OR Cartesia cold-start + Vapi speaks warm openers with a prompt rule to say the opener
  verbatim. See open decisions.

### Phase 2 — User transcript: one live bubble per utterance
- Port from the full-duplex branch (`OnboardingChatPage.tsx:100-165`): partial buffer, clear
  coach-partial when user speaks, 1500ms safety-clear if a final never lands, and MERGE
  consecutive finals (Soniox/Vapi emit several on long utterances) into one bubble.
- Fix `LiveUserBubble` so a final doesn't vanish while the user is still talking.

### Phase 3 — Loading / thinking states
- Port `TypingIndicator.tsx` (three bouncing dots) into the flow feed.
- Show it when: (a) Vapi connecting (pre-opener-audio), (b) awaiting coach reply after a user
  final, (c) a Vapi tool call is in flight (between user answer and the next opener/advance).
- Tool-call indicator = neutral dots, NOT "Saving…" (privacy rule: never narrate the system).
- Drive from `OnboardingVoiceProvider` status + a tool-call-in-flight signal (the gap between
  a data-tool fire and the realtime current_step climb).

### Phase 4 — Tighten one-bubble-per-turn live streaming (coach)
- Mostly exists. Audit `assistantTurnOpenRef` / merge window so a slow reply never splits, a
  fast follow-up never merges across beats, and reveal stays audio-synced (no fixed-timer on
  covered beats). Add `useSmoothReveal`-style char fade on the trailing edge if desired.

### Phase 5 — Verify nothing renders that isn't live
- Audit the feed: only the rigid spoken opener is authored; every other coach line comes from
  Vapi/LLM. Remove any leftover static coach text.

## Sensitive risks + de-risking
1. **Vapi↔Cartesia handoff** (double-speak, mic-open timing, one-voice) — the most fragile.
   Already solved for cold-start; widening coverage multiplies handoffs. De-risk: keep it
   flag-gated, expand beats one at a time with a mic pass each.
2. **Card-reveal coupling** — BeatPlayer reveals the card after the coach line finishes
   (12s safety ceiling). Don't let new reveal logic strand cards. Keep the ceiling.
3. **Turn-merge races** — porting must not split or drop turns. Cover with the existing
   merge tests + add cases.
4. **Nav untouched** — all of this is RENDER-side. Must not touch the realtime-sync /
   orchestrator advance path (the thing we just unified). Hard line.
5. **Cost / idle** — wider Vapi coverage interacts with Milestone 3 (8s idle teardown).
   Confirm teardown holds before shipping wide coverage.

## Decisions (locked 2026-06-28)
1. **Opener rigidity** → Cartesia speaks the cold-start opener (rigid verbatim); Vapi speaks
   warm-beat openers, prompt-locked to say the authored opener verbatim. (Add/verify a
   verbatim-opener rule in the synced Vapi addendum.)
2. **Coverage rollout** → INCREMENTAL. Expand `CHAT_VAPI_BEAT_SCREENS` a few beats at a time
   (profile→fork→category→goals→habits→…), a live mic pass per expansion. No big-bang flip.
3. **Indicator** → neutral typing dots only (no label, no "saving").

## First concrete step
P3 (typing indicator) + P2 (user-bubble fix) are render-only and beat-agnostic — safe to
build first and they improve every beat immediately, independent of coverage. Then P0/P1
roll out incrementally behind the mic pass. Suggested order: **P3 → P2 → P0(+P1) one beat
at a time → P4 → P5.**

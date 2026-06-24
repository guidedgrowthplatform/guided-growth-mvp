# Onboarding Vapi — System Gap Audit (findings only, not fixed)

_Date: 2026-06-24 · Surface: `OnboardingChatPage` (`/onboarding`), `VITE_ONBOARDING_CHAT_VAPI=true`_

Read-only audit by 5 parallel agents. The `engineForTurn` selector closed the old
dual-init / mic-contention bugs by construction; below is what it did **not** close,
ranked by impact on a smooth Vapi experience. Severities: **P0** breaks first-run for
most users · **P1** silent stuck/dead-end · **P2** rough but recoverable · **P3** polish/cleanup.

## Tier 1 — fire on normal use / block first run

### P0 · First-run mic dead-end — voice coach is silently absent

Defaults are `voiceMode:'voice'`, `micEnabled:true`, **`micPermission:false`**
(`snapshot.ts:32-34`). A new user lands on the profile beat with voice intent on but
mic ungranted → `engine='vapi'` but `vapiShouldBeLive=false` (`OnboardingVoiceProvider.tsx`
gates on `micPermission===true`). Vapi can't start, Direct-LLM is (correctly) suppressed
so **no opener ever streams**. `vapiPendingMic` only suppresses the typing dots
(`OnboardingChatPage.tsx`) — there is **no copy/CTA/prompt** telling the user to tap the
mic. The chat flow has no `MIC-PERMISSION` step (the routed flow did). Confirmed by 3 of 5
agents. _Result: the headline voice experience is missing on first run; user falls back
to tapping the card and never hears the coach._

### P0/CRITICAL · Beat card REMOUNTS (loses typed input) when the opener lands

`BeatFeed` has two structural branches keyed on `renderMsgs.length`: empty → card renders
last; non-empty → card renders as the 2nd child. When the opener final lands (empty→non-empty),
the `OnboardingCardSlot` changes structural position → React **remounts it**, wiping any
in-progress input (typed nickname, half-selected category). On a Vapi beat the opener lands
seconds after the card appears. _Introduced by the recent opener→card→rest reorder. Fires
every beat._

### P1 · Committed bubble + transient streaming tail = double bubble mid-turn

Vapi splits one turn into multiple finals. Final #1 commits a merged bubble; segment #2's
partials then render as a **separate** streaming `ChatBubble` below it, until #2's final
merges in. So mid-turn the user sees two bubbles that collapse to one — visible flicker on
every speech pause within a turn. The `assistantMergeOpen` window was built for inline
rendering but `BeatFeed` never reads it (dead). _Fires on every multi-segment coach turn._

### P1 · Typing indicator oscillates mid-turn

`isAssistantSpeaking` (`state==='speaking'`) drops to `listening` between segments of one
turn, and `displayedAssistant` momentarily empties → the typing dots pop in under the
committed bubble, then speech resumes. "typing…speaking…typing…speaking" on a long reply.

### P1 · Silent failures — no error UI, no recovery on the chat page

Three independent silent-stuck paths, all because the page never surfaces error state:

- **Realtime down:** `OnboardingChatPage` calls `useOnboardingRealtimeSync()` and discards
  the `'error'` status. If the channel fails, Vapi tool writes never reach the cache →
  card never fills, beat never advances → the exact bug we just fixed, but invisibly.
- **Fatal Vapi error** (401/403/429/bad config): sets `fatalErrorRef` permanently →
  `vapiShouldBeLive` forever false. The page never reads `session.errorMessage` and never
  calls `restartCall` (both exist in context, wired to nothing). Orbs show "on", nothing happens.
- **Tool error** (`validation_failed`/`profile_missing`/`cannot_skip_steps`): the handler
  writes nothing → no Realtime event → UI shows nothing. Recovery relies entirely on Vapi's
  model re-asking; if it doesn't, the user silently stalls on a frozen card.

### P1 · Voice cap = frozen beat, fallback doesn't engage

Cap reached with both orbs on: `vapiShouldBeLive=false` but `engine` is still `'vapi'`, so
`chatEnabled` stays false → Direct-LLM never takes over. `VoiceCapModal` promises "type
anytime," but dismissing it leaves the user on a capped beat with no working engine until
they manually toggle voice off. Default cap is **25** with a "Revert before launch" comment
(UX-12 says 5).

## Tier 2 — correctness gaps (wrong data / wrong flow)

### HIGH · Cold-start drops already-captured fields → coach re-asks at the fork

`buildOverridesForCall` passes `filledFormState: formSnapshotRef.current` only — and the
chat page **never calls `setFormSnapshot`** (it's wired only in the routed `OnboardingLayout`),
so the ref is permanently `{}`. The mid-session `pushScreenContext` path merges persisted
`onboarding_states.data` (`{...persisted, ...snapshot}`), but the **cold-start path does not**.
So any Vapi cold start at the fork (toggled voice off→on, or a remote-end retry) ships the
fork context with no `*** USER KNOWN STATE ***` → the coach can greet generically / re-ask
the nickname. One asymmetry, two entry points; cold start is exactly when the opener speaks.

### HIGH · Card-tap + voice double-advance skips the fork

`useChatToolEvents.ts:132-136` bumps `current_step` with bare `prev+1` for beat-completing
tools — every other path in that file uses `Math.max` for idempotency. If the user taps the
profile card (optimistic →2) **and** speaks (`submit_profile` tool event → `+1` = 3), the
**fork beat is skipped entirely**. The one place "is advance idempotent?" answers no.

### HIGH · Post-fork handoff has a no-engine window

At step 2→3 the engine flips `vapi`→`direct_llm` via a derived chain (cache → beat re-resolve
→ `registerScreen` → `vapiCapableBeat` false → `engine` flips → `chatEnabled` true). Between
Vapi stopping and Direct-LLM's `chatEnabled` turning on, **neither engine drives step 3's
opener** for a render window. No explicit "Vapi handoff → prime Direct-LLM opener" bridge.

### HIGH/MED · Vapi vs Direct-LLM precondition divergences (behavior differs by engine)

The two precondition sets are documented to mirror but don't:

- **Step 1:** Vapi `navigateNext.ts:67` requires only `nickname`; Direct-LLM
  `preconditions.ts` requires nickname+age+gender. Same profile advances under one, blocks
  under the other.
- **Step 4 (advanced/braindump):** Direct-LLM gates on `brainDumpRaw`; Vapi unconditionally
  requires `data.goals` (which braindump never writes) → Vapi would hard-block the advance.

### MED · Realtime `data` wholesale-replace can clobber optimistic seeds

The clamp protects `current_step` and `path`, but spreads `...next` for `data`. A data-only
Vapi write carrying a staler `data` can momentarily clobber an optimistically-seeded
`category`/`goals` → next beat's card flickers empty until its own save echoes back.

### MED · Refresh mid-Vapi wipes the transcript

Vapi turns live only in provider state and are never persisted (`chat_messages` is written
only by `/api/llm`). History rehydration is gated on `chatEnabled` = false in Vapi mode. On
refresh the dialogue is gone (form data + step survive); Vapi restarts and re-greets.

## Tier 3 — lifecycle / cost / UX rough edges

- **Idle timer is a no-op for Vapi.** After 8s silence `systemPauseMic()` sets a flag that
  `vapiShouldBeLive` doesn't read (Soniox honors it; Vapi doesn't) → the hot full-duplex mic
  never auto-pauses. Battery/cost leak.
- **Remote-end auto-restart re-narrates the opener** after a silent 3s cooldown (`onCallStart`
  resets `lastPushedScreenIdRef` → `pushScreenContext` re-fires with `triggerResponseEnabled`).
  A network blip feels like the conversation reset.
- **`endCall` cross-chain phantom-start risk** — bypasses the `lastTransitionRef` promise
  chain; a queued `start()` can resolve after the synchronous `stop()` → audio on `/home`.
- **Stale user partial sticks forever** — `partialUser` is only cleared by an assistant
  partial or a user final; a dropped final / echo partial with no following coach turn leaves
  a ghost half-sentence user bubble (no idle-timeout clear, unlike `isUserSpeaking`).
- **Blank active beat edge** — a `cardType:'none'` beat with `vapiPendingMic` and no opener
  renders nothing (no card, no dots, no opener): empty screen + orb.
- **Orphans re-home to the active beat** — turns tagged with sub-screen ids absent from
  `SCREEN_TO_STEP` are permanent orphans and visually jump under the active beat on advance.
- **Post-fork is text-only** — after the fork `speakReplies=false` (voice-out silently stops
  mid-onboarding) and mic needs `VITE_STATE3_ENABLED`; with it off, post-fork mic does nothing.

## Tier 4 — env, telemetry, dead code

- **Env undocumented/untyped:** `VITE_ONBOARDING_CHAT_VAPI` (the master switch) is in no
  `.env.local.example` and not in `vite-env.d.ts`; same for `STATIC_FEED`, `VAPI_DAILY_CAP`,
  `VOICE_CAP_DISABLED`. The flow needs **both** `VITE_ONBOARDING_CHAT_VAPI` and
  `VITE_STATE3_ENABLED` for full voice — undocumented.
- **`VITE_ONBOARDING_STATIC_FEED` footgun:** if it leaks into a build, onboarding renders
  cards but never fires LLM/Vapi turns and never completes.
- **No mic grant/deny telemetry on the chat page** (`mic_permission_granted/denied` only
  logged by the legacy `MicPermissionPage`) → first-run funnel drop-off at the mic gate is
  invisible.
- **Dead/contradictory surface:** Beat 0 is `auth` so the whole `PreferencesCard` path is
  unreachable; legacy routed `/onboarding/step-*` pages are still directly reachable and
  write the same row (contradictory-state risk via deep link/QA); `OnboardingChatOverlay`
  only mounts for the now-unreachable `!onChatPage` onboarding case.
- **Markdown on voice transcripts** — spoken `*`/`_`/`1.`/backticks parse as markdown
  (spurious bold/italic/list in bubbles). **Auto-scroll** keyed on `messages.length` misses
  long single-turn streams (live text scrolls off-bottom). **Dedup (1500ms)** drops a legit
  immediate repeat ("Yes." … "Yes.").
- **Completion edges:** stale comment claims `confirm_plan` doesn't bump `current_step` (it
  does → 8); advanced-path completion may not satisfy `deriveStateFromOnboarding` if it keys
  only off `habitConfigs` (advanced stores `advancedHabitConfigs`) — verify `planReviewDerive.ts`.

## Suggested fix order (when you're ready)

1. **First-run mic CTA** (P0) + **surface errors/Realtime-failure** (P1) — the silent-stuck trio.
2. **Card remount** (P0) + **double-bubble / typing oscillation** (P1) — every-turn visual jank.
3. **Cold-start persisted-data merge** + **card-tap/voice double-advance** + **precondition parity** — correctness.
4. Post-fork voice, refresh persistence, idle-timer, remote-end re-narrate — lifecycle polish.
5. Env docs/types, dead-code removal, telemetry — ship hygiene.

# Onboarding Beats — Vapi Full-Duplex Integration Plan

_Date: 2026-06-24 · Owner: Yonas · Surface: `/onboarding/chat` (beat-based chat page)_

## 0. One-paragraph summary

The beat-based onboarding chat (`OnboardingChatPage`) already supports the four
dual-button orb states — but **State 1 (both halves on) is deliberately downgraded
to a Cartesia+Soniox Direct-LLM loop "emulating Vapi", not real Vapi.** This plan
promotes State 1 on the chat page to **real Vapi full-duplex** (the same Path-1
session the routed onboarding screens already use), while leaving States 2/3/4
(Soniox-only STT, Cartesia-only TTS, text-only) on the existing Direct-LLM path
exactly as they are. The crux is **dual context regimes**: Vapi needs the rich
`screen_contexts` block (forward pointers intact, drives `navigate_next`); the
Direct-LLM beat path needs `beatContexts.ts` (forward pointers stripped). The chat
page must serve whichever regime the live orb state selects, and hand off cleanly
when the user toggles a half mid-session.

---

## 1. Target behavior (the four states on the chat page)

**Scope decision (2026-06-24): onboarding uses NO standalone Cartesia.** The only
spoken voice in onboarding is Vapi (State 1). The Direct-LLM beat path is **text-only**
(Soniox in → LLM → text reply, no TTS). Cartesia still runs _inside_ the Vapi session
(Vapi's own TTS) — that is unaffected; we are only removing the standalone
Cartesia/karaoke TTS path from the onboarding Direct-LLM surface.

| Orb state                  | Buttons                       | Engine on chat page TODAY              | Engine AFTER this plan                               |
| -------------------------- | ----------------------------- | -------------------------------------- | ---------------------------------------------------- |
| `vapi` (State 1)           | voice-out **on** + mic **on** | Direct-LLM (Cartesia+Soniox, remapped) | **Real Vapi full-duplex** ✅ NEW                     |
| `voice_in_only` (State 3)  | voice-out off, mic on         | Soniox STT → Direct-LLM (text reply)   | **same path, this is the 2nd live mode** ✅          |
| `voice_out_only` (State 2) | voice-out on, mic off         | Direct-LLM + Cartesia TTS (karaoke)    | **Cartesia removed → text-only** (not a target mode) |
| `text_only` (State 4)      | both off                      | Direct-LLM text                        | text-only (unchanged)                                |

User's stated mental model, mapped to the above:

- "vapi both orb on" → State 1 (`vapi`) — **the main work.**
- "soniox + llm when the mic orb is on" → State 3 (`voice_in_only`) — already works, keep as-is.
- "forget about cartesia for onboarding for now" → remove the standalone Cartesia/karaoke
  TTS from the onboarding Direct-LLM path. Openers render as **text** (no spoken opener)
  unless Vapi is live. State 2 collapses to text-only.

---

## 2. Current architecture (verified, with file:line anchors)

### 2.1 Orb state derivation & routing

- `src/lib/orb/orbState.ts:1-9` — `OrbState = 'vapi' | 'voice_out_only' | 'voice_in_only' | 'text_only'`; `orbStateFrom(voiceOn, micOn)`.
- `src/hooks/useDualButtonControls.ts:16-59` — `voiceOn = preferences.voiceMode === 'voice'`; `micOn = micPermission && micEnabled`; `toggleVoice` stops TTS on off, `toggleMic` gated on `micAllowed`.
- `src/lib/orb/routeOrbSend.ts:1-27` — `routeOrbSend({orbState, surface,…})` → `'vapi' | 'onboarding' | 'checkin' | 'llm' | 'noop'`. `vapi` short-circuits (Vapi owns its turns); `surface==='onboarding'` → Direct-LLM beat path.

### 2.2 The two suppression points that block Vapi on the chat page

- **Orb remap** — `src/contexts/OnboardingVoiceProvider.tsx:740-741`:
  ```ts
  const rawOrbState = orbStateFrom(voiceOn, micOn);
  const orbState = onChatPage && rawOrbState === 'vapi' ? 'voice_in_only' : rawOrbState;
  ```
- **Vapi live gate** — `OnboardingVoiceProvider.tsx:951-965` `vapiShouldBeLive` includes `!onChatPage`.
- `onChatPage` defined at `OnboardingVoiceProvider.tsx:129` (`location.pathname === ONBOARDING_CHAT_ROUTE`).

### 2.3 Existing Vapi (Path 1) machinery — reuse wholesale

- `src/hooks/useRealtimeVoice.ts:325-531` `start()` / `:277-283` `stop()` — Vapi SDK client lifecycle, one instance per hook mount, listeners (`call-start`, `speech-start/end`, `message`, `tool` webhook echoes, `error`, `call-end`).
- `src/lib/voice/buildAssistantOverrides.ts:44-55` — cold-start context via `variableValues.initial_screen_context`.
- `OnboardingVoiceProvider.tsx:228-260` `pushScreenContext()` — mid-session `client.send({type:'add-message', …, triggerResponseEnabled:true})`.
- `OnboardingVoiceProvider.tsx:274-334` `setFormSnapshot()` — debounced (1200ms) snapshot push.
- **Tool webhook loop:** `api/vapi/[...path].ts:91-180` → `api/_lib/vapi/dispatch.ts:29-62` → `api/_lib/vapi/handlers/*` → Supabase (service role) → Realtime.
- **Realtime → cache:** `src/hooks/useOnboardingRealtimeSync.ts:30-107` (guards against rewinding `current_step`).
- **Step model:** `navigate_next` is the **only** tool that bumps `current_step` (`api/_lib/vapi/handlers/navigateNext.ts:100-200`, precondition-gated, +1 discipline).

### 2.4 The beat system (Direct-LLM, what the chat page uses now)

- `src/hooks/useOnboardingBeat.ts:12-39` — `beatForStep(step, path)` selects `{step, screenId, cardType}`; `advance(toStep)` optimistic.
- `src/lib/onboarding/onboardingStepBeats.ts:22-87` — step↔screenId map; `stepForScreenId()` reverse.
- `src/lib/onboarding/onboardingChatCards.ts:86-134` — `buildActiveBeatCard()` synthesizes a pre-filled card from live `onboarding_states.data`.
- `src/pages/onboarding/OnboardingChatPage.tsx:364-465` — `BeatFeed` renders per-step: opener → frozen card (`buildActiveBeatCard`) or message-attached cards → orphans.
- `src/hooks/useOnboardingChat.ts` — Direct-LLM stream, chunked karaoke TTS (`:279-301`), deferred final append (`:307-395`), `sendUserTurn` (`:455-500`).
- **Backend beat context:** `api/_lib/llm/buildSystemPrompt.ts:71-83` swaps to `getBeatContext(screenId)` for `ONBOARD-*`; strips forward pointers (`:99`), renames `navigate_next`→`advance_step` (`:100`), `NO_PRENARRATION_RULE`.

### 2.5 The explicit "don't" from the migration plan

`beat-context-migration-plan-2026-06-23.md:362-375`:

> "Do **not** feed Vapi the beat context. Keep the rich `context_block` (Supabase + bundle) for Vapi; the beat layer is Direct-LLM-only."

This is the central design constraint, not a blocker — it means the chat page is **bi-modal**: Vapi mode reads `screen_contexts`; Direct-LLM mode reads `beatContexts`. They already coexist for routed screens; we are extending the coexistence to one page.

---

## 3. Design

### 3.1 Promote State 1 on the chat page (the unlock)

Gate both suppression points behind a feature flag `VITE_ONBOARDING_CHAT_VAPI`
(default off → zero behavior change until we flip it).

- `OnboardingVoiceProvider.tsx:740-741` — only remap `vapi→voice_in_only` when the flag is **off**:
  ```ts
  const chatVapiEnabled = onChatPage && FLAGS.onboardingChatVapi;
  const orbState =
    onChatPage && rawOrbState === 'vapi' && !chatVapiEnabled ? 'voice_in_only' : rawOrbState;
  ```
- `vapiShouldBeLive` (`:951-965`) — replace `!onChatPage` with `(!onChatPage || chatVapiEnabled)`.
- `chatEnabled` (Direct-LLM, `:754-762`) already excludes `orbState === 'vapi'`, so once the remap is lifted, State 1 stops driving Direct-LLM automatically. **No double-engine** — they are mutually exclusive by construction. Verify this exclusivity in a test (see §7).

### 3.2 Context regime selection — the bi-modal core

When Vapi is live on the chat page, **the beat's `screenId` must resolve to its rich
`screen_contexts` block**, not `beatContexts`. The Direct-LLM backend swap in
`buildSystemPrompt.ts` is irrelevant here because Vapi does not call `/api/llm`.
Instead Vapi context flows through the existing front-end path:

1. The provider already calls `getScreenContext(screenId)` for cold start
   (`buildOverridesForCall` `OnboardingVoiceProvider.tsx:575-613`) and mid-session
   (`pushScreenContext` `:228-260`). Those read `src/generated/screen_contexts.json`
   (bundle) → Supabase fallback. **This is the rich block — exactly what Vapi needs.**
2. **Coverage gap to close:** Vapi on the chat page will request context for the
   beat screenIds. Confirm each has a rich block:
   - `ONBOARD-01--FORM` ✅ (CLAUDE.md notes it's sourced from the gg-spec packet).
   - `ONBOARD-BEGINNER-01/02/03/07`, `ONBOARD-ADVANCED/-02/-04/-05` — verify in
     `screen_contexts.json` / Supabase `screen_contexts`.
   - `ONBOARD-AUTH--FORM`, `ONBOARD-FORK--FORM` — **likely missing.** These are
     beat-only synthetic screens. Decide: (a) author rich blocks for them, or
     (b) keep auth/fork beats on Direct-LLM/tap even in "Vapi mode" (Vapi only
     arms at step ≥1 or ≥3). See Open Question Q3.

**Decision:** keep `screen_id` as the single keyspace (per migration plan) — no new
`beat_id`. The chat page passes `beat.screenId` to the existing provider context
plumbing; the provider decides the source (rich for Vapi, beat for Direct-LLM)
purely by which engine is live. No new branching in `getScreenContext`.

### 3.3 Beat-change → mid-session context push

Routed screens push context on `registeredScreenId` change (page mount). The chat
page never route-changes; the beat changes in place when `current_step` moves. Wire
a new trigger:

- In `OnboardingChatPage`, subscribe to `useOnboardingBeat().beat.screenId` and call
  `context.registerScreen(beat.screenId)` whenever it changes (it already calls a
  variant of this — confirm it fires on beat change, not just mount).
- The provider's existing effect (`OnboardingVoiceProvider.tsx:1060-1071`) watches
  `registeredScreenId` and calls `pushScreenContext` when Vapi is `active`. So beat
  advance → `registerScreen(newScreenId)` → `pushScreenContext` → Vapi speaks the
  next beat's opener from the rich block. **Reuses the screens path verbatim.**
- Guard: `lastPushedScreenIdRef` already dedupes; the `current_step`-rewind guard in
  `useOnboardingRealtimeSync` already prevents oscillation.

### 3.4 Card rendering in Vapi mode

In Direct-LLM mode, cards attach to the LLM opener turn (`openerCardRef`,
`useOnboardingChat.ts:128-129`). **Vapi has no Direct-LLM opener turn** — it speaks
its own first message. So in Vapi mode, cards must render as **frozen beat cards**
from `buildActiveBeatCard(beat)` only (the `BeatFeed` already has this path at
`OnboardingChatPage.tsx:407-...`, used when no message-attached card exists).

- When `chatVapiEnabled && orbState==='vapi'`: skip `openerCardRef` attachment; rely
  entirely on the frozen-card branch keyed by `beat.cardType`.
- Vapi tool writes (`submit_profile`, `submit_category`, …) → Supabase → Realtime →
  React Query cache → `buildActiveBeatCard` re-derives the filled card. **Auto-fill
  already works** via `useOnboardingRealtimeSync`. No new wiring for fill.
- The card's own submit button still works as a manual fallback (tap path), writing
  via `saveStepAsync` + `advance`. Keep idempotent (server `GREATEST` upsert).

### 3.5 Message feed unification (transcript display)

The chat feed must show Vapi's spoken transcript turns the same way it shows
Direct-LLM bubbles. Vapi already produces `messages: VoiceMessage[]` in the provider
(`useOnboardingVoiceSession.ts:25-34`, each carries `screenId` + optional `cards`).

- `BeatFeed` groups by `screenId` (`OnboardingChatPage.tsx:364-465`). Ensure Vapi
  `VoiceMessage`s are tagged with the **current beat's screenId** at emit time so they
  land in the right beat group (the provider tags from `currentScreenId` — confirm it
  uses the beat screenId on the chat page, not `PROVIDER_SCREEN_TAG='onboard_session'`).
- Source the feed from a **single merged list**: in Vapi mode read provider
  `messages`; in Direct-LLM mode read `useOnboardingChat` messages. Add a thin
  selector in `OnboardingChatPage` that picks the active source by engine, so the
  renderer stays engine-agnostic (mirrors the check-in "renderer subscribes, driver
  emits" rule from `checkin-scripted-flow-plan-2026-06-18.md:123-127`).
- Karaoke: Vapi streams its own audio + (optionally) transcript timestamps; the
  Direct-LLM karaoke chunker (`useOnboardingChat.ts:279-301`) is **off** in Vapi mode
  (no `speakReplies` Direct-LLM path runs). No duplicate-bubble risk because the
  deferred-append logic only runs in the Direct-LLM mirror effect.

### 3.5b Remove standalone Cartesia from the onboarding Direct-LLM path

Per the 2026-06-24 scope decision, onboarding's Direct-LLM path is text-only. Force
`speakReplies = false` for the onboarding surface so the chunked-TTS effect
(`useOnboardingChat.ts:279-301`) and the deferred karaoke append (`:307-395`) never
engage:

- Gate `speakRepliesRef` on the onboarding surface to always-false (don't let the
  voice-out half drive Cartesia). The mirror effect then takes the **immediate-append**
  branch (`:390-391`) — text bubbles land instantly, no karaoke defer, no `/api/cartesia-tts`
  calls.
- Beat openers: today the chat page speaks each opener via Cartesia
  (`onboarding-chat-status-2026-06-24.md`). With Cartesia removed, openers render as
  **text bubbles only** when Vapi is not live. In State 1 the opener comes from Vapi's
  spoken first message instead.
- Net: the only `/api/cartesia-tts` traffic from onboarding disappears; Cartesia audio
  exists only _inside_ Vapi sessions. `useVoiceInput`/Soniox path is untouched.

### 3.6 Navigation must stay in-place on the chat page

`navigate_next` → `current_step` → Realtime. On routed screens, `useAgentNavigation`
turns a `current_step` change into a React-Router `navigate()` to the next step page.
**On the chat page we must NOT route away** — the page renders all beats; the active
beat just changes.

- Verify `useAgentNavigation` (in `useOnboarding.ts`) is suppressed when
  `chatNative`/`onChatPage` is true (the chat-native flow already relies on this for
  Direct-LLM advances — confirm it also covers Vapi-driven `current_step` bumps).
- Beat advance render path: `current_step` change → `useOnboardingBeat` re-selects
  beat → `BeatFeed` shows the next beat → `registerScreen(newScreenId)` →
  `pushScreenContext`. Closed loop, no route change.

### 3.7 Live orb toggling — Vapi ⇄ Direct-LLM handoff mid-beat

Toggling either half mid-session changes `orbState`, which must swap engines:

- **State 1 → 2/3/4** (user turns a half off): `vapiShouldBeLive` goes false → provider
  effect (`:971-1008`) calls `stop()` (Vapi WebRTC closes, instance retained);
  `chatEnabled` flips true → `useOnboardingChat` Direct-LLM takes over. Mic-mute /
  TTS handoff already handled per state.
- **State 2/3/4 → 1** (user turns the other half on): `vapiShouldBeLive` true → `start()`
  with cold-start context for the **current** beat screenId (so Vapi resumes mid-flow,
  not from step 0).
- **Continuity:** Vapi cold start injects `initial_screen_context` for the current
  beat + `setFormSnapshot` of already-captured data, so the coach resumes coherently.
  No transcript replay into Vapi (it can't ingest the Direct-LLM history) — acceptable;
  the rich block + form snapshot give it enough state. Document this as expected.
- **Debounce / thrash guard:** rapid toggling should not spam start/stop. The existing
  `remoteEndCooldown` + a small debounce on engine switch (e.g. 400ms settle) prevents
  WebRTC churn. Add if not already present.

### 3.8 Mic permission / voice mode preconditions

State 1 requires `voiceMode==='voice'` + `micEnabled` + `micPermission`
(`useDualButtonControls`/`vapiShouldBeLive`). Beat 0 (auth) currently keeps mic off
until profile (`OnboardingChatPage.tsx:155-169`). Preserve that: Vapi should not arm
during the auth beat (see §3.2 coverage gap + Q3). Earliest Vapi arm = the first beat
that has a rich context block and is post-auth.

---

## 4. Backend — what changes (mostly nothing)

- **Vapi tool handlers:** already exist and write to `onboarding_states`
  (`api/_lib/vapi/handlers/*`). Reused as-is. No new handlers.
- **`navigate_next` preconditions** (`navigateNext.ts:100-200`): already enforce the
  same per-step data requirements as the Direct-LLM `checkAdvanceData`
  (`api/_lib/llm/onboarding/preconditions.ts:7-61`). **Audit for parity** — the two
  precondition sets must agree so a beat advance behaves identically whether driven by
  Vapi `navigate_next` or Direct-LLM `advance_step`. List any drift.
- **Webhook secret/auth** (`verifyVapiSecret`): unchanged.
- **Vapi assistant config (dashboard):** reuse the existing onboarding assistant
  (same `VITE_VAPI_ASSISTANT_ID`). Its prompt already consumes
  `{{initial_screen_context}}` and the rich block's forward pointers to drive
  `navigate_next`. No new assistant unless Q1 says otherwise.
- **`screen_contexts` authoring:** close the coverage gap (§3.2) for any beat
  screenIds missing a rich block. This is content work in the Master Sheet →
  `seed_contexts.py` → Supabase + re-export `screen_contexts.json`.

---

## 5. Risks & hard problems

1. **Context drift between regimes.** Vapi (rich block) and Direct-LLM (beat context)
   can phrase the same beat differently, so toggling mid-beat changes the coach's voice.
   Mitigation: keep beat openers and rich-block openers semantically aligned for the
   beat screenIds; accept minor wording drift (the migration plan already accepts two
   parallel blocks).
2. **Double-advance race.** Vapi `navigate_next` + a manual card submit both bump
   `current_step`. Server `GREATEST` upsert + Realtime rewind-guard already make this
   idempotent; add a test (§7).
3. **Echo / barge-in.** Real Vapi handles this internally (full-duplex) — _better_ than
   the Direct-LLM emulation. The known Direct-LLM bug ("Soniox hearing anything cancels
   the LLM call", fixed via `owesResponseRef`, per `onboarding-chat-voice-handoff-2026-06-24.md`)
   simply does not apply in Vapi mode. Net reliability win for State 1.
4. **Coverage gap (auth/fork beats).** No rich block → Vapi has nothing to say. Must
   resolve via Q3 before flipping the flag.
5. **Message tagging.** If Vapi `VoiceMessage`s carry `PROVIDER_SCREEN_TAG` instead of
   the beat screenId, they won't group under the active beat. Verify emit-time tagging
   (§3.5).
6. **Navigation leak.** If `useAgentNavigation` is not suppressed on the chat page for
   Vapi-driven `current_step`, the app routes away from `/onboarding/chat`. High-impact;
   covered by §3.6 + test.
7. **Toggle thrash → WebRTC churn.** §3.7 debounce.
8. **Refresh/rehydration.** Chat thread is not rehydrated on refresh
   (`EMPTY_INITIAL_MESSAGES`, per voice handoff doc). A mid-Vapi refresh restarts the
   Vapi session from the current beat (acceptable — server state persists). Document.

---

## 6. Phased implementation

**Phase 0 — Spike / verify (no behavior change).**

- Confirm engine mutual-exclusivity (`orbState==='vapi'` ⇒ `chatEnabled===false`).
- Audit `screen_contexts` coverage for all beat screenIds; produce the gap list.
- Audit `navigate_next` vs `checkAdvanceData` precondition parity.
- Confirm `useAgentNavigation` suppression on the chat page covers Vapi advances.

**Phase 1 — Flag + unlock (dev only).** `VITE_ONBOARDING_CHAT_VAPI` default off.

- Lift the two suppression points (§3.1).
- Wire beat-change → `registerScreen` → `pushScreenContext` (§3.3).
- Frozen-card-only rendering in Vapi mode (§3.4).

**Phase 2 — Feed + nav.**

- Merge message source by engine; verify Vapi message screenId tagging (§3.5).
- Confirm in-place navigation; no route leak (§3.6).

**Phase 3 — Handoff polish.**

- Vapi⇄Direct-LLM mid-beat toggle, cold-start resume with form snapshot, debounce (§3.7).

**Phase 4 — Content + parity.**

- Author rich blocks for any gap beats (or scope Vapi to post-auth beats per Q3).
- Fix any precondition drift.

**Phase 5 — Rollout.** Flip flag in dev → staging → prod behind the existing
voice-cap/daily-cap guards. Keep Direct-LLM emulation as the fallback (flag off).

---

## 7. Test plan

- **Unit:** `orbStateFrom` matrix; engine-exclusivity (vapi ⇒ !chatEnabled); precondition
  parity (`navigate_next` vs `checkAdvanceData`) for every step.
- **Integration (mocked Vapi):** beat advance → `registerScreen` → `pushScreenContext`
  called once per beat; Realtime tool write → `buildActiveBeatCard` fills card.
- **Race:** simultaneous `navigate_next` + card submit → `current_step` lands once, no
  rewind.
- **Toggle:** State 1↔3 mid-beat → exactly one engine live at a time; no WebRTC churn
  under rapid toggle.
- **Nav-leak guard:** Vapi `current_step` bump on chat page does **not** call router
  `navigate()`.
- **Manual:** full voice run-through (auth→profile→fork→beginner branch) in State 1;
  toggle to State 3 mid-flow and back; refresh mid-session.

---

## 8. Decisions (locked 2026-06-24)

- **Q1 — Assistant: REUSE** the existing onboarding Vapi assistant
  (`VITE_VAPI_ASSISTANT_ID`). No new dashboard assistant. Its prompt already consumes
  `{{initial_screen_context}}` and drives `navigate_next` off the rich block.
- **Q2 — Live toggling: MID-BEAT, DEBOUNCED.** User can flip a half anytime; engine
  swaps with a short settle debounce + Vapi cold-start resume from the current beat
  (§3.7). Engine exclusivity test is mandatory.
- **Q3 — Auth/fork coverage: ARM VAPI POST-AUTH ONLY.** Beat 0 (auth) stays on the
  Direct-LLM/tap path; Vapi earliest-arm is the first post-auth beat with a rich block.
  Don't author blocks for synthetic auth beats. (Fork: author a rich block only if/when
  we extend Vapi past profile.)
- **Q4 — Scope: BOTH branches eventually, but NOT YET.** Current onboarding work is only
  at **Beat 1 — profile setup** (`ONBOARD-01--FORM`). **Immediate target: get State-1
  Vapi working for the profile-setup beat only.** Beginner/advanced branch beats follow
  once the rest of the beat flow is built out. This narrows Phase 1 dramatically — see §9.

## 8b. Screens-flow ground truth — the "no improvisation" contract

Verified by deep trace of the live screens flow. The beat page MUST reproduce this
exactly; **nothing in this section changes.** The Vapi assistant is route-agnostic — it
is driven entirely by `screen_id` (inside `initial_screen_context`) and `current_step`
(moved by `navigate_next`). It never knows routes exist.

**What defines the ask→save→advance behavior (all reused verbatim, zero edits):**

1. **Dashboard system prompt** (Coach-Yair tone) — product-owned, lives only in the Vapi
   dashboard, contains the `{{initial_screen_context}}` placeholder. Not in repo, not touched.
2. **Managed tool-calling addendum** — `scripts/vapi-sync/assistant.ts:18-270`, synced into
   the dashboard prompt between `<!-- MANAGED:TOOL_CALLING_RULES -->` sentinels. The binding
   rules: RULE 1 "Save FIRST, always"; RULE 2 screen→data-tool table (ONBOARD-01--FORM →
   `submit_profile`); RULE 3 + 7.5 "data_tool → navigate_next, same turn,
   target_step = currentStep+1"; RULE 7.6 "navigate_next ends the turn, don't pre-fire next
   screen"; RULE 8 "directional, not a coaching conversation". This is the no-improvisation
   contract itself.
3. **Tool schemas** — `api/_lib/llm/tools.onboarding.ts` (`submit_profile` :116-150,
   `navigate_next` :428-455). `requestStart`/`requestFailed` messages are `""` (deliberate
   silence during the webhook round-trip).
4. **Per-screen context block** — `src/generated/screen_contexts.json`. For
   `ONBOARD-01--FORM`: an explicit `ALLOWED TOOLS` allow-list (`submit_profile` +
   `navigate_next(target_step=2)` only), a `FORBIDDEN` list, the ASK script (name/age/gender/
   referral), and a `NEXT: -> ONBOARD-FORK--FORM` forward pointer. **Vapi sees this block RAW**
   (forward pointers + `--- SUPPLEMENTARY ---` tail intact) — that's how it knows to advance.
   (Direct-LLM strips them; Vapi must not.)
5. **Handlers** — `submitProfile.ts` saves to `onboarding_states.data` only and **never
   touches `current_step`** (`:122-130`); `navigateNext.ts` is the ONLY step-mover, gated by
   `checkAdvanceData` (step 1→2 hard-requires `data.nickname`, `:58-98`). Both return
   `{result:'ok'}`. Webhook always HTTP 200, errors in the `error` field
   (`api/vapi/[...path].ts`).

**The exact runtime message sequence (reused verbatim):**

- **Cold start:** `vapi.start(ASSISTANT_ID, { firstMessageMode:
'assistant-speaks-first-with-model-generated-message', variableValues: {
initial_screen_context: buildContextMessage({screen_id, context_block, state_delta,
filled_form_state}), anon_id, session_id, screen:'onboard_session', coaching_style } })`.
  The LLM generates turn 0 from prompt + substituted context. (`useRealtimeVoice.ts:499-516`,
  `buildAssistantOverrides.ts:44-55`, `buildContextMessage.ts:95-146`.)
- **Mid-session screen change:** `client.send({ type:'add-message', message:{ role:'system',
content: buildContextMessage(...) }, triggerResponseEnabled: true })` — the `true` makes
  Vapi speak the new screen's opening line. (`pushScreenContext`,
  `OnboardingVoiceProvider.tsx:228-260`.)
- **Field-fill update (no speech):** same `add-message` with `triggerResponseEnabled: false`,
  body `[FORM STATE UPDATE]…`, debounced 1200ms. (`setFormSnapshot`, `:274-334`.)
- **Save:** Vapi → `POST /api/vapi/tool` (anon_id/session_id injected as static server params,
  LLM can't spoof) → `dispatch` → handler → Supabase → Realtime.
- **Advance:** same-turn `navigate_next(target_step=2)` → `navigateNext` verifies `nickname`,
  writes `current_step=2` → Realtime → `useOnboardingRealtimeSync` updates cache (rewind-clamp
  `Math.max(prev,next)`).

**The ONLY differences between screens and the beat page (the entire delta):**

| Concern                           | Screens flow                                            | Beat page (target)                                  | Change needed                                                             |
| --------------------------------- | ------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| Reaction to `current_step` change | `useAgentNavigation` → `navigate('/onboarding/step-N')` | `useOnboardingBeat` re-selects beat **in place**    | Suppress `useAgentNavigation` on chat page (already done for chat-native) |
| `filled_form_state` source        | form fields via `setFormSnapshot`                       | beat card state / `onboarding_states.data`          | Feed card-derived snapshot via the same `setFormSnapshot`                 |
| Data echo to UI                   | form auto-fills from Realtime                           | `buildActiveBeatCard` re-derives card from Realtime | None — both already react to Realtime                                     |
| `currentScreenId` source          | page mount `registerScreen`                             | beat-change `registerScreen(beat.screenId)`         | Wire beat-change → `registerScreen`                                       |
| Vapi suppression                  | n/a                                                     | chat page remaps `vapi→voice_in_only`               | Lift behind flag (§3.1)                                                   |

That's the whole list. The assistant, tools, addendum, handlers, webhook, and Realtime sync
are **untouched**. The beat page reuses `OnboardingVoiceProvider`'s Vapi plumbing as-is; it
just renders `current_step` as an in-place beat instead of a route.

## 9. Immediate next step — Vapi on the profile beat (`ONBOARD-01--FORM`)

Because the live onboarding work is only at the profile beat, the first shippable slice is
small and well-scoped:

**Two live modes for the profile beat:** State 1 (both orbs) → **Vapi**; State 3 (mic
only) → **Soniox → LLM → text reply**. No standalone Cartesia (§3.5b). The profile
opener is text unless Vapi is speaking it.

1. **Flag + unlock (§3.1)** behind `VITE_ONBOARDING_CHAT_VAPI`, default off.
2. **Kill standalone Cartesia (§3.5b)** for the onboarding surface — `speakReplies=false`.
3. **Earliest-arm = profile beat:** Vapi only goes live on the chat page when
   `beat.screenId === 'ONBOARD-01--FORM'` (and prefs/mic/permission satisfied). Auth beat
   stays Direct-LLM/tap.
4. **Context:** `ONBOARD-01--FORM` already has a rich `screen_contexts` block (gg-spec
   packet source — CLAUDE.md). Cold-start `initial_screen_context` + `setFormSnapshot`
   of any captured nickname/age. No content authoring needed for this slice.
5. **Tools in scope for this beat:** `submit_profile` (data) + `navigate_next` (advance to
   fork). Both handlers already exist (`api/_lib/vapi/handlers/`). Verify `navigate_next`
   step-1→2 precondition (nickname/age/gender present) matches `checkAdvanceData`.
6. **Card:** `ProfileCard` renders as the frozen beat card; Vapi `submit_profile` →
   Realtime → `buildActiveBeatCard` fills it. Manual tap-submit remains the fallback.
7. **Feed:** show Vapi transcript turns tagged with `ONBOARD-01--FORM`.
8. **Toggle:** State 1 ⇄ State 3 on the profile beat, debounced, resume from profile.
9. **Done = ** voice run of the profile beat: speak name/age/gender → card fills → coach
   confirms → `navigate_next` advances to fork; toggling a half mid-beat swaps engines
   cleanly; no route leak off `/onboarding/chat`.

Defer until the beat flow is built out: fork/beginner/advanced beats, their rich-block
coverage, and the full §6 phasing.

# Onboarding Chat — Vapi/LLM/Soniox Harmonization Bugs (investigation, no fixes)

_Date: 2026-06-24 · Surface: `OnboardingChatPage` (`/onboarding`), flag `VITE_ONBOARDING_CHAT_VAPI=true`_

Read-only multi-agent investigation. **Nothing fixed yet** — this is the bug map +
harmonization proposal.

## Root cause (one defect behind most symptoms)

There is **no single engine selector**. Three independent boolean predicates each
derive from overlapping inputs with their own ad-hoc guards:

- `vapiShouldBeLive` — `OnboardingVoiceProvider.tsx:979-995`
- `chatEnabled` (Direct-LLM via `useOnboardingChat`) — `:783-788`
- `voiceInShouldBeLive` (Soniox via `useVoiceInCapture`) — `:770-771`

Their only interlock is `chatEnabled`'s `orbState !== 'vapi'` clause. But `orbState`
only becomes `'vapi'` once `chatVapiAllowed` is true, and `chatVapiAllowed` depends on
`registeredScreenId` — a state value set by a **post-mount effect** on the page
(`OnboardingChatPage.tsx:111-113`). So there is a guaranteed window where the user has
both orbs on but `orbState` is still remapped to `voice_in_only`, and Direct-LLM is
allowed to fire. The engines are mutually exclusive _in steady state only_, not by
construction.

---

## BUG 1 — Dual init: Direct-LLM fires alongside Vapi (the "confusing between the two")

**Render sequence on landing on the profile beat, both orbs on:**

1. Render 1 (mount): `registeredScreenId === null` → `chatVapiAllowed = false`
   (`:763-764`) → `rawOrbState='vapi'` remapped to `orbState='voice_in_only'`
   (`:766-767`) → `vapiShouldBeLive=false`; `chatEnabled` satisfiable
   (`chatScreenId` falls back to `currentScreenId`, `overlayOpen`/`voiceInShouldBeLive`
   true) → **`useOnboardingChat` mounts enabled and seeds an opener** → `/api/llm`
   `mode:"opener"`.
2. Effects fire: `registerScreen(beat.screenId)` + `openOverlay()`.
3. Render 2: `chatVapiAllowed=true` → `orbState='vapi'` → `chatEnabled=false`, Vapi arms.

But the Direct-LLM opener already launched, and **disabling never aborts it**:

- The only abort tied to engine switch is `useOnboardingChat.ts:317-319`
  (`orbState==='vapi'` → `cancel()`), which cancels only an _in-flight_ stream and is a
  one-shot on the transition.
- `toolActive = enabled || streamActiveRef.current` (`useOnboardingChat.ts:349`)
  keeps the reply pipeline alive after `enabled` flips false.
- A stable (authed) session defers the opener until `historyLoaded`
  (`useOnboardingChatSession.ts`); if history is cached (`staleTime: Infinity`) the
  opener fires synchronously inside the `chatEnabled===true` window → guaranteed
  dual-init. `useLLM` aborts only on `cancel()`/`reset()`/unmount — none tied to
  `enabled` (`useLLM.ts:366-379`).

**Also re-fires every beat past the fork:** `CHAT_VAPI_BEAT_SCREENS` is only
`{ONBOARD-01--FORM, ONBOARD-FORK--FORM}` (`:104-107`). After `navigate_next` moves to
any other beat with both orbs on, `chatVapiAllowed` flips false → `orbState`
remaps to `voice_in_only` → `chatEnabled` true → Direct-LLM seeds that beat's opener
and accepts turns. That's the wall of `ONBOARD-BEGINNER-02` openers in the logs.

---

## BUG 2 — Vapi and Soniox both own the mic (both orbs on, Vapi beat)

`voiceInShouldBeLive` (`:770-771`):

```ts
VOICE_IN_ENABLED && inOnboarding && micOn && (onChatPage || !voiceOn) && !!currentScreenId;
```

The `(onChatPage || !voiceOn)` clause bypasses the `!voiceOn` exclusion on the chat
page, so when both orbs are on AND Vapi is armed, `voiceInShouldBeLive` is **also**
true. Vapi owns the mic over WebRTC while Soniox opens a second browser mic session.
A partial guard downstream (`useVoiceInCapture.ts:36-39` suppresses when
`vapiStatus==='active'/'connecting'`) masks the steady state, but: (a) during Vapi's
async start window Soniox boots; (b) `startKeyWarmLoop()` (`:937-941`) fires every Vapi
turn regardless. It's a status-race guard, not an ownership guard.

---

## BUG 3 — Cartesia gate is the wrong layer (the "remove any call to cartesia")

`speakReplies: onChatPage ? false : voiceOn` (`:808`) DOES gate every Cartesia call
_inside_ `useOnboardingChat` (`beginSpeechTurn`/`pushSpeechChunk`/`speak` all checked
against `speakRepliesRef`, plus a proactive `stopTTS()` at
`useOnboardingChat.ts:322-324`). So with the flag wired, the hook itself won't call
Cartesia — good. **But the real Cartesia gate is a different, lower flag:**
`isVoiceOutEnabled()` = `voiceMode === 'voice'` (`src/lib/services/voiceGate.ts:19-21`).
The chat page's left orb (`OnboardingChatPage.tsx:354` → `useDualButtonControls.ts:22-26`)
sets `voiceMode:'voice'`, which opens that global gate even though `speakReplies` stays
false. Today nothing on this page calls through the open gate (the only caller is gated
by `speakReplies`), so it's latent — but it's the wrong architecture: Cartesia should be
gated by a chat-page-aware signal, not by `voiceMode`. Recommendation: make the chat
surface never depend on `voiceMode` for Cartesia, or have `isVoiceOutEnabled()` honor a
"no standalone TTS here" flag.

---

## BUG 4 — Profile saves only the nickname (age/gender/referral dropped)

NOT a key-mismatch (handler writes `nickname/age/gender/referralSource`,
`submitProfile.ts:106-109`; card reads the same, `onboardingChatCards.ts:99-109` /
`ProfileCard.tsx:44-55`). Ranked causes:

1. **Most likely — the model sent only `nickname`.** The log shows `submit_profile`
   once then `navigate_next`. The navigate gate requires only nickname
   (`navigateNext.ts:67`: `if (!data.nickname) return 'profile_missing'`), the schema
   allows partial calls (`tools.onboarding.ts:147` `required:[]`), and the addendum
   (`scripts/vapi-sync/assistant.ts` RULES 1/7.5) says "save first, navigate same turn"
   but **never says bundle all four profile fields in one call.** So it grabs the name,
   saves, navigates — dropping the rest.
2. **Contributing — contradictory age guidance.** Schema/handler require a numeric
   string 13–120 (`tools.onboarding.ts:132-135`, `submitProfile.ts:83-91`), but the
   `ONBOARD-01--FORM` context block PARSING tells the model to send age **buckets**
   ("25"→"25-34"). A bucketed age fails validation (`age_not_numeric`); on a silent
   retry (addendum RULE 6) the model re-sends without age.
3. Referral free-text values like "Social media" persist but `canonicalReferral`
   (`ProfileCard.tsx:31-35`) can't map them → chip shows unselected (display drop).

- Ruled out: merge clobber (jsonb `||` merges, `submitProfile.ts:127`) and Realtime
  clamping (only clamps `current_step`/`path`, `useOnboardingRealtimeSync.ts:80-88`).

Fix direction (backend/prompt, not frontend): (a) addendum/context instruction to send
all four fields in ONE `submit_profile` call; (b) fix the age-bucket contradiction in
`screen_contexts.json`; (c) optionally require >nickname in `navigateNext.ts:67`.

---

## Both orbs OFF (answering "what happens?") — already correct

`text_only` → Vapi dormant (`voiceMode!=='voice'`), Soniox dormant (`micOn` false, no
key-warm loop), `chatEnabled` true → Direct-LLM runs `inputMode:'text'`, `speakReplies`
false → **text-only conversation, zero Cartesia, zero Soniox. The LLM just lists the
conversation.** This is the desired behavior; no change needed here.

---

## Harmonization proposal — one `engineForTurn` selector (design only)

Replace the three independent predicates with one pure, unit-testable selector
(colocated with `orbState.ts` / `routeOrbSend.ts`):

```ts
type ChatEngine = 'vapi' | 'direct_llm' | 'idle';
engineForTurn({ surface, rawOrbState, vapiCapableBeat, beatResolved, chatVapiFlag,
                identityReady, capReached, fatal, cooldown })
  -> { engine: ChatEngine, micSource: 'vapi' | 'soniox' | 'none', speakReplies: boolean }
```

Rules (chat surface):

- **Undecided guard:** `surface==='chat' && !beatResolved` (registeredScreenId null) →
  `{ idle, none, false }`. Neither engine arms until the beat is known → **kills BUG 1's
  mount race** without disabling post-fork Direct-LLM.
- `rawOrbState==='vapi' && chatVapiFlag && vapiCapableBeat && healthOk` →
  `{ vapi, micSource:'vapi', speakReplies:false }`.
- else → `{ direct_llm, micSource: micOn ? 'soniox' : 'none', speakReplies:false }`.

Derive the three booleans as **projections** so mutual exclusion holds by construction:

- `vapiShouldBeLive = decision.engine==='vapi' && …health`
- `chatEnabled = decision.engine==='direct_llm'`
- `voiceInShouldBeLive = decision.micSource==='soniox'` → **fixes BUG 2** (Soniox can
  never be live while engine is vapi; the `(onChatPage || !voiceOn)` hack disappears).

Plus:

- **Engine-change effect:** on any `decision.engine` change, abort the outgoing engine
  (`llm.cancel()` + clear `streamActiveRef`/pending refs) BEFORE arming the incoming one,
  and pre-seed the incoming Direct-LLM `openerSeededRef` for the current beat so it does
  **not** re-narrate an opener Vapi already spoke (fixes the duplicate-opener transition
  - the `enabled:false`-doesn't-abort gap).
- **Single preference write** for "go full Vapi": one
  `updatePreferences({ voiceMode:'voice', micEnabled:true })` instead of two, so orbState
  never passes through an intermediate engine.
- **Cartesia:** drive `speakReplies`/`isVoiceOutEnabled` from the decision, not from
  `voiceMode`, so the chat surface structurally can't call standalone Cartesia (BUG 3).
- Optional: stamp each `VoiceMessage` with `engine` for a dev-only dedup assertion.

### Smallest standalone fixes (if not doing the full selector now)

1. `voiceInShouldBeLive` (`:770-771`): add `&& orbState !== 'vapi'` — stops Vapi/Soniox
   mic contention (BUG 2).
2. Chat-page idle guard: while `registeredScreenId === null`, force both `chatEnabled`
   and `vapiShouldBeLive` false — stops the mount-race dual-init (BUG 1).
3. Abort effect in `useOnboardingChat` on `enabled:false` — tears down a turn started in
   a transient window (BUG 1).
4. Backend/prompt: bundle-all-profile-fields instruction + age-bucket fix (BUG 4).

### Key files

`src/contexts/OnboardingVoiceProvider.tsx` (`:104-107, 763-771, 783-788, 979-995, 1001-1038`),
`src/hooks/useOnboardingChat.ts` (`:239-313, 317-319, 349`), `src/hooks/useLLM.ts` (`:366-379`),
`src/hooks/useVoiceInCapture.ts` (`:36-39`), `src/lib/services/voiceGate.ts` (`:19-21`),
`src/lib/orb/orbState.ts`, `api/_lib/vapi/handlers/submitProfile.ts` + `navigateNext.ts:67`,
`api/_lib/llm/tools.onboarding.ts`, `scripts/vapi-sync/assistant.ts`,
`src/generated/screen_contexts.json` (ONBOARD-01--FORM).

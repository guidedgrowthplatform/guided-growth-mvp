# Onboarding voice handoff (2026-06-30)

Part 1 of 2. This covers ONBOARDING. The morning/evening check-in is a separate part, to follow.

Branch: `feat/soniox-profile-fill` (off `staging`). Preview: https://gg-3phgpgsi6-guided-growths-projects.vercel.app
Read this against your own branches before merging. Some of the open items below may already be solved in your code, so compare first.

## How to run it

1. Open the preview at `/onboarding/qa`.
2. Tap the **Mic + Profile** tile (it says "fresh launch"). One tap wipes onboarding state, signs in the test user, grants the mic, unlocks browser audio, and lands you on a clean profile beat.
3. Walk the flow. Speak your age and gender on the profile beat.
4. Top-right there are two QA pills: a sound on/off, and a **Vapi on/off**. Vapi is OFF by default. Flip it on to run the Vapi path (reloads).

## The voice model (the intent this build encodes)

- Soniox (the mic) is always listening unless the user turns it off via the orb.
- The coach (Direct-LLM) reads the Soniox transcript and fills the form. No Vapi in the loop for the fixed captures.
- Voice-out: MP3 for the fixed lines, Cartesia for the dynamic bits (the name), Vapi for the single habit-brainstorming beat later.
- Vapi is kept fully intact (the whole beat set and transport), gated behind a runtime flag `localStorage gg_vapi_enabled` (default off). Flipping it on routes the Vapi-capable beats to Vapi again.

## What is DONE (working on this branch)

1. Standalone Soniox transcription works. In testing it transcribed "I'm 44 and male" into the chat.
2. The no-Vapi Direct-LLM path: the engine resolves to `direct_llm` with `micSource: 'soniox'` on the onboarding beats, so the provider Soniox is armed and the coach fills the form.
3. Vapi intact behind a toggle. `CHAT_VAPI_BEAT_SCREENS` is unchanged (all 10 beats), the transport and assistant config are untouched, and `ONBOARDING_CHAT_VAPI` now reads the localStorage flag (default off).
4. QA "Mic + Profile" one-click-fresh entry: wipes via `/api/qa/self-reset`, grants the mic, unlocks audio via `unlockTTS()`, lands on profile, in a single tap.
5. The `/api/llm` 500 is fixed at the root (see Bugs fixed, item 1).
6. `submit_profile` carries the user's name, so the save no longer loops "trouble saving".
7. Icon bundle regenerated, so the weather/mood icons render locally instead of the blocked CDN.
8. Hybrid-beat handling (card reveal gated on the MP3 finishing, no duplicate opener) is in, relevant when an MP3 opener and live voice share a beat.

## Bugs FOUND and FIXED (with root cause)

1. **`/api/llm` returned 500 on every Direct-LLM coach turn (the coach spun forever).**
   Root cause: `tsc -b` trusted a stale incremental cache and skipped emitting `packages/shared/src/generated/checkin_scripts.ts`, so `dist/generated/checkin_scripts.js` was missing from the deployed bundle. `/api/llm` imports it transitively (`scriptVariations.js`), so the function crashed on load with `ERR_MODULE_NOT_FOUND`. It stayed invisible because the profile beat is the first thing that actually calls `/api/llm` on the Direct-LLM path (profile used to be a Vapi beat). Fix: `--force` on `build:shared` and `postinstall` in `package.json`, so every deploy emits the generated modules. Confirmed locally that a forced build produces the file. **Compare on your side: if your build already forces or cleans the shared package, this fix may be redundant or collide. This is a shared-package build issue that breaks any `/api/llm` caller, including the check-in flows.**
2. **`submit_profile` rejected with "nickname required", coach looped "trouble saving your information".**
   The handler hard-requires `nickname`, but the profile capture sent only age and gender (the name was seeded separately). Fix: pass the seeded nickname through the capture and add `nickname` to the tool's `persistsFields`.
3. **Vapi was starting on the profile beat (it should not).**
   Fix: the engine routing. Profile is no longer Vapi-capable by default, and Vapi is gated behind the flag.
4. **Two Soniox mic sessions fighting.**
   An early attempt ran a second Soniox inside the profile form on top of the provider's. They contended and nothing transcribed. Fix: removed the adapter-owned Soniox; the provider's standalone Soniox (the proven one) is the single mic owner.
5. **Hybrid-beat double-talk and a card-reveal deadlock.** Fixed (the MP3-opener and live-voice coexistence on the two hybrid beats).
6. **QA "fresh" was not actually fresh.** Picking the flow tile resumed the prior run. Fix: the Mic + Profile tile wipes state first, in one click.

## Bugs and issues OPEN (not done)

1. **The coach echoes the literal `{name}` token** instead of the user's name on its dynamic reply. The static opener substitutes the name correctly; the coach's LLM response prints `{name}`. This is coach context or prompt handling, not the renderer.
2. **Soniox cuts off the first word** (for example "44" comes through as "4"). The mic arms about a beat late, so it misses the start of the first utterance. Needs the mic armed earlier (tied to item 3).
3. **The orb should default to both halves on**, so Soniox is listening the instant a beat loads. The user's model is "Soniox always on unless turned off". Right now the orb starts off and toggling it is a no-op on the direct path. Needs the default voice/mic state set on for the onboarding flow.
4. **The morning/evening check-in live coach is not wired.** The flow beats use screen ids `MCHECK-STATE`, `ECHECK-HABITS`, `ECHECK-REFLECT`, but the check-in tool registry only exposes tools for `HOME-CHECKIN`, `MCHECK-01`, `ECHECK-01`, and there are no coach-brain entries for the MCHECK/ECHECK beats. The preview renders the cards but the live coach can't call its tools. This is the Part 2 piece.
5. **The 3 Vapi-path bugs from the dev sync** (for when Vapi is on): transcription quality (Soniox-through-Vapi is worse than standalone), the component must show before any text, and the chat must auto-scroll so the latest message sits above the orb.

## What is expected from you (compare and consolidate)

Before re-implementing any open item, check your own branches. Likely overlaps to compare:
- The Soniox cut-off and the mic-arm timing, plus the orb default state. Did you already warm the mic or default the orb on?
- The check-in coach wiring (MCHECK/ECHECK tools and brain entries). Is this already in a branch?
- The `{name}` substitution on the coach's dynamic reply.
- The shared-package build emit. If your build already forces or cleans, align on one approach so the `package.json` change does not conflict.

A consolidation research pass is running to map this branch against your existing work; findings will be appended.

## Where things live

- Engine decision: `src/lib/orb/engineForTurn.ts`
- Voice provider and Soniox: `src/contexts/OnboardingVoiceProvider.tsx`, `src/hooks/useVoiceInCapture.ts`, `src/lib/services/soniox-stream.ts`
- Beat adapters: `src/onboarding-flow/renderer/componentRegistry.tsx`
- Vapi toggle: `src/lib/config/voice.ts`, `src/onboarding-flow/qaVapi.ts`, `src/onboarding-flow/QAVapiToggle.tsx`
- QA entry: `src/onboarding-flow/QAControlScreen.tsx`
- Coach backend: `api/llm/[...path].ts`, `api/_lib/llm/buildSystemPrompt.ts`
- The build fix: `package.json` (`build:shared`, `postinstall`)
- Design intent (visual-first, word-by-word sync): `Yair-Context/handoffs/HANDOFF-beats-av-sync.md`

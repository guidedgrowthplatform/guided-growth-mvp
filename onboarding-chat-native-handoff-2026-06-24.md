# Onboarding chat-native — handoff (2026-06-24)

Concise current-state handoff. For depth see the plan docs:
`beat-context-migration-plan-2026-06-23.md`, `onboarding-seeded-chat-plan-2026-06-23.md`,
and the prior `onboarding-chat-native-handoff-2026-06-23.md` (sessions 1–3 history).

> Work in the LIVE repo `/Users/jonah/Documents/guided-growth-mvp` (not a worktree).

## The model (unchanged)

`current_step` → `beatForStep(step, path)` → `{ screenId, cardType }`. `/onboarding` is a
single page; each beat = one coach line + one inline card. Auth is Beat 0 (a pre-chat gate).

## What shipped this session

- **Auth is real, in-chat.** `AuthSignupCard` wires Google (`signInWithGoogle`), email signup
  (`signUp` → "check your email"), and login (`signIn`); Apple = "coming soon" (as before).
  `AppGate` lets unauthed users render `/onboarding` (the only unauthed-reachable protected
  route); all `app` routes still bounce them. Once authed, the page auto-advances past auth →
  profile (`OnboardingChatPage` effect: `authed && currentStep===0 → advance(1)`).
  `OnboardingInput` gained `type="password"` + reveal.
- **Beat-context pipeline (backend source of truth).** `api/_lib/llm/onboarding/beatContexts.ts`
  holds per-beat `{ context, allowedTools, opener }`. `buildSystemPrompt.ts` uses it for every
  `ONBOARD-*` screen and **skips the Supabase `screen_contexts` read** for onboarding (check-ins/
  app unchanged). Renders a `## Tools For This Beat` block from `allowedTools` (steering; Stage 2
  = code-enforce by filtering the OpenAI tools array, NOT done).
- **LLM renders the opener verbatim.** On opener turns, `buildSystemPrompt` injects a
  `## Onboarding Opener … say WORD-FOR-WORD … Say, exactly: "<line>"` block (mirrors the check-in
  scripted opener). Frontend: `useOnboardingChat` fires `llm.sendOpener()` per beat (like the home
  check-in), card attaches to the streamed opener message.
- **Live feed + never-blank baseline.** `VITE_ONBOARDING_STATIC_FEED=false` (`.env.local`) → page
  renders the live `messages.map` feed. `StaticFeed` renders whenever `messages.length === 0` —
  the synchronous never-blank fallback (authored opener + card). On a successful opener the live
  feed takes over seamlessly (verbatim text == authored line). Auth beat is NOT seeded into the
  thread (StaticFeed draws + hides it once authed).

## Wired vs dormant (right now)

- LIVE: LLM openers (verbatim); Cartesia TTS speaks the opener (default orb = `voice_out_only`);
  card taps drive every beat advance; tool dispatch (`useChatToolEvents`) un-gated.
- DORMANT: Soniox voice-in (double-gated: `VITE_STATE3_ENABLED` + non-default `voice_in_only`
  orb state needing mic permission); NO text composer. So the user responds **only via card taps**
  → it reads as a card wizard with a spoken opener, not a dialogue. Full turn-loop = "Stage C".
  Vapi (Path 1) intentionally off on this page.

## Open issues / next

1. **"Feels static" UX**: the opener stream is hidden behind StaticFeed (no visible typing), and
   verbatim text looks identical to the fallback. Fix: show a typing indicator / streaming partial
   while `messages.length===0`.
2. **Silent opener failure**: `sendOpener` uses `surfaceErrors:false` → `llm.error` never set →
   the authored-line fallback (in `useOnboardingChat` error effect) never fires; it just stays on
   StaticFeed (not blank, but undetectable). Fix: surface opener errors or change the trigger.
3. **Stage C — voice-in / real conversation**: lift the Soniox turn loop (barge-in, mic-mute-on-
   playback) into onboarding so the user can talk back.
4. **Stage 2 — code-enforced tool gating** in `registry.ts` using `allowedTools`.
5. **JSON→Supabase sync automation** for beatContexts (deferred); backend currently reads the file.
6. Beats past profile unpolished; advanced-path cards not built.

## Gotchas

- LLM opener = **authored line verbatim** → visually identical to the static line (by design).
- `StaticFeed` is the synchronous never-blank baseline; the live LLM feed takes over at
  `messages.length > 0`. Don't reintroduce a feed that waits on the network with no fallback.
- Onboarding LLM context comes from `beatContexts.ts` (api-side), **not** Supabase. Frontend opener
  fallback copy = `src/components/onboarding/onboardingOpeners.ts` — keep the two opener strings in
  sync until a shared source lands.
- `/api/llm` gets only `screen_id`; the backend builds the prompt. The frontend bundle
  `src/generated/screen_contexts.json` feeds Vapi (dormant) + `/api/context` fallback, not the
  onboarding LLM.
- Run/verify: `npm run dev:api` (builds shared, serves frontend + `/api` on :3000).
  `npx tsc --noEmit` clean; `npx vitest run` green except 3 pre-existing `resolveCheckinWindow`.

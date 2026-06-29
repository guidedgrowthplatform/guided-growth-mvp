# Onboarding Unified Engine, branch handoff

Branch: `onboarding-unified-engine` (this repo, ggmvp-unified). MR !361.
Last updated: 2026-06-25.

This is the chat-native onboarding engine. It runs the onboarding as a data-driven
"beat" flow that matches the visual flow-builder design, with the voice stack
(MP3, Cartesia, Vapi) layered for low perceived latency. This doc is the catch-up
for picking the branch up cold: what it is, what is shipped, what is still open,
and how to run it.

## TL;DR

- This branch is the canonical onboarding engine. The orchestrator, the renderer,
  the 12 beats, the voice cascade, auth-in-flow, and the flow-builder bridge all
  live here and nowhere else that is current.
- Two older parallel trees exist (`flow-builder-app-connection` in ggmvp-flow-engine,
  and `feat/onboarding-chat-vapi-fullduplex` in ggmvp-his). They are ancestors or
  duplicate earlier attempts. Do not re-merge them into this branch expecting them
  to add something, they will conflict and regress. This branch already
  re-implemented their work on a cleaner surface.
- It is flag-gated and not live by default. Fresh signups only reach it when the
  cutover flag is on.

## The engine, how it is built

- Orchestrator: `useFlowOrchestrator` drives the beat sequence (current beat,
  next/back, fork branch).
- Renderer: `FlowRenderer` / `BeatView` / `componentRegistry` render each beat from
  data. `useFlow` is the load seam (loads the generated JSON from the flow-builder,
  falls back to the in-repo TS flow).
- Beats: 12-beat flow in `src/onboarding-flow/flows/`, matched 1:1 to the
  flow-builder design (auth signup, mic permission, profile age/gender, fork, etc).
- Flow-builder bridge: the designer flow exports to generated JSON, the engine runs
  that JSON. `npm run flow:sync` regenerates it. This is the one-way design to
  engine path.
- Auth is inside the flow: the auth/signup beat uses real auth (Google, Apple,
  email). A logged-out user can render the flow's auth beat and sign in without
  leaving onboarding.

## The voice cascade (the latency design)

The point is to hide Vapi's cold-start. Layers, in order, each covering the next
one's spin-up time:

1. MP3, zero latency. The splash/welcome screen plays a local MP3
   (`public/voice/splash_welcome.mp3`), it plays the instant the screen loads, no
   network round-trip.
2. Cartesia, fast. On the first voice beat (the profile beat), the moment the beat
   becomes active it speaks the opener line (with the user's name) over Cartesia
   HTTP one-shot (`speakOpener.ts`, `/api/cartesia-tts`).
3. Vapi, slow to connect, so it opens in the background WHILE Cartesia is still
   talking. Vapi joins muted (`firstMessageMode: assistant-waits-for-user`). The mic
   opens only when BOTH the Cartesia opener has finished AND Vapi has joined.

Voice identity is aligned on both engines: Pro Voice Clone V1
(`104635f9-8991-403c-9988-bc5b70b39939`), model `sonic-3.5-2026-05-04`,
Cartesia-Version `2026-03-01`, so the instant opener and Vapi sound identical.

Flags: `VITE_ONBOARDING_INSTANT_OPENER` (the Cartesia opener),
`VITE_ONBOARDING_CHAT_VAPI` (Vapi full-duplex on the chat-native beats).

## What we have (shipped on this branch)

Engine and flow:

- Synced-file overlay (Global context + per-beat context) wired from generated data.
- Vapi full-duplex voice transport grafted onto the unified engine.
- Opening animation (orb bloom plus coach MP3) before sign-in.
- Voice orb, latest flow-builder design, voice capture and save.
- Splash "Get Started" gate so the welcome audio plays reliably (browsers block
  autoplay before a user gesture).
- 12-beat flow matched to the flow-builder design.
- Flow-builder bridge: run the flow from generated data.
- Auth moved into the flow (designer auth-signup plus real auth).

Voice:

- Vapi and Cartesia aligned on Pro Voice Clone V1 plus sonic-3.5-2026-05-04.
- Instant Cartesia opener to hide Vapi cold-start (flag-gated).

Routing and QA:

- Cutover flag to route fresh signups to the new engine (default off).
- QA control launcher route plus self-reset / list-users endpoints (for repeated
  no-login testing, see Open items, this is still being finished by a parallel
  effort).

Review fixes and the idle pause:

- Three shared-layer fixes pulled from the 2026-06-25 onboarding AI review
  (commit `1db501a6`).
- Idle auto-pause now measures continuous user silence (commit `5af17659`),
  detailed below.

## The idle auto-pause fix (commit 5af17659)

Symptom in live test: on the chat-native flow, when the coach was waiting for the
user and the user stayed silent, Vapi did not turn off after 8 seconds, the coach
just repeated its question and the mic stayed hot (burning Vapi minutes).

It was two compounding bugs:

1. Arming. The 8s timer only armed once the coach had spoken, and "coach has spoken"
   was set only by Vapi's own TTS. On the instant-opener path the opener is spoken
   by Cartesia while Vapi joins silently, so Vapi never speaks and the timer never
   armed. Fixed: the timer also arms when the Cartesia opener completes.
2. Countdown. The timer re-armed a fresh 8s every time Vapi state bounced
   listening to speaking to listening. Vapi's own idle re-prompt fires around 7.5s
   (the assistant nudging a quiet user), which bounced the state and reset the timer
   before it ever reached 8s. Fixed: the countdown now measures continuous USER
   silence (`lastUserActivityAt`, updated only by user speech), so an assistant
   re-prompt no longer resets it. At 8s of real user silence the mic pauses
   (`systemPauseMic`) and Vapi tears down. A tap or speak re-arms it.

Helpers and tests are in `src/contexts/idleTimerGate.ts` and
`src/contexts/__tests__/idleTimerGate.test.ts` (14 tests, including one that proves
an assistant re-prompt mid-silence does not reset the user-silence countdown).
Barge-in and active listening are intact (live user speech pushes the deadline
forward).

This maps to P7 in the 2026-06-25 AI review. P6 and P8 from that review landed in
`1db501a6`. The remaining review items targeted the old routed onboarding flow that
this engine replaces, so several do not apply to the engine and should be
re-verified against it rather than assumed open.

## Still in progress / open

- Optional Vapi-side toggle: disabling `messagePlan.idleMessages` would stop the
  assistant re-prompting a quiet user at all (cleaner than relying only on the
  client pause). It writes to the SHARED Vapi assistant config via `vapi:sync`, so
  it was deliberately NOT applied here, it needs a decision from whoever manages
  the Vapi assistant. The exact change is captured as a patch (ask for it). The
  client-side fix above already makes the 8s pause work without it.
- QA control screen for no-login repeated testing: the launcher route and
  self-reset / list-users endpoints are in (`5c6f0b38`), the control screen UI is
  still being finished.
- Cutover is not flipped live. `VITE_ONBOARDING_USE_ENGINE` is off by default, so
  fresh signups still get the old flow. Flip when we are ready.
- OAuth redirect URLs for Google / Apple in the auth beat need the right config per
  environment.
- beat content: ggmvp-his (`feat/onboarding-chat-vapi-fullduplex`) has a
  `beatContexts.ts` that differs from this branch by ~200 lines. The transport work
  there is already superseded, but if any of that beat-content authoring is the
  canonical wording, it is worth a glance before that branch is retired.

## Consolidation notes

- Canonical: this branch (`onboarding-unified-engine`) is the single source of
  truth for the engine.
- Superseded, do not re-merge: `flow-builder-app-connection` (ggmvp-flow-engine) is
  the original orchestrator/renderer this branch rebuilt and deleted ~2958 lines of.
  `feat/onboarding-chat-vapi-fullduplex` (ggmvp-his) is an older, different Vapi
  full-duplex implementation, this branch has its own newer one (`1ba3c975`).
- Separate workstreams, not engine work: `splash-intro` (intro animation and
  flow-designer experiments) and `i18n-localization-proof` (Hebrew / Spanish) do
  not touch the engine modules.

## How to run and test

Flags for the full experience:

- `VITE_ONBOARDING_INSTANT_OPENER=true`
- `VITE_ONBOARDING_CHAT_VAPI=true`
- `VITE_ONBOARDING_USE_ENGINE=true` (only if you want fresh signups routed here,
  otherwise reach it directly)

Route: `/onboarding/flow`. A logged-out user lands on the auth beat, signs in, and
stays in the flow. A user who already finished onboarding is correctly sent to home,
so test with a fresh account that has not completed onboarding.

Idle-pause re-test: reach the first voice beat (profile), let the Cartesia opener
play, then stay completely silent. Around 7.5s the assistant may re-prompt once,
keep silent. At about 8s of continuous silence the mic should pause and the Vapi
call should tear down (not keep re-prompting). Then tap or speak to confirm it
re-arms. Separately, speak partway through to confirm barge-in still pushes the
deadline forward.

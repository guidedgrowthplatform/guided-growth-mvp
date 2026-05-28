# Path 1 Surfaces — Where Vapi Runs

Every place the conversational onboarding journey lives.

## Beginner onboarding

| Page component | Screen ID | Today | Target |
|---|---|---|---|
| `src/pages/onboarding/shared/Step1Page.tsx` | `onboard_01` | Cartesia Line via `useOnboardingAgent('onboard_01')` | Vapi assistant via Vapi Web SDK |
| `src/pages/onboarding/shared/Step2Page.tsx` | `onboard_02` | same | same |
| `src/pages/onboarding/beginner/Step3Page.tsx` | `onboard_03` | same | same |
| `src/pages/onboarding/beginner/Step4Page.tsx` | `onboard_04` | same | same |
| `src/pages/onboarding/beginner/Step5Page.tsx` | `onboard_05` | same | same |
| `src/pages/onboarding/beginner/Step6Page.tsx` | `onboard_08` | same | same |
| `src/pages/onboarding/shared/PlanReviewPage.tsx` | `onboard_07` | same | same |

## Advanced onboarding

| Page component | Screen ID | Today | Target |
|---|---|---|---|
| `src/pages/onboarding/advanced/AdvancedInputPage.tsx` | `onboard_advanced_input` | Cartesia Line via `useOnboardingAgent` | Vapi assistant |
| `src/pages/onboarding/advanced/AdvancedCustomPromptsPage.tsx` | `onboard_advanced_custom_prompts` | same | same |
| `src/pages/onboarding/advanced/AdvancedResultsPage.tsx` | `onboard_advanced_results` | same | same |
| `src/pages/onboarding/advanced/AdvancedStep6Page.tsx` | `onboard_advanced_step_6` | same | same |
| `src/pages/onboarding/advanced/EditHabitPage.tsx` | n/a | Uses `useVoiceInput` (Path 2 transcript-only), not the realtime agent | unchanged |
| `src/pages/onboarding/advanced/EditJournalPage.tsx` | n/a | No voice wiring today | TBD |

## Onboarding chat overlay

`src/components/onboarding/OnboardingChatOverlay.tsx` — coached chat surface that can appear inside any onboarding step.

| Today | Target |
|---|---|
| Voice mode: voice-commands pipeline (Cartesia REST STT/TTS + GPT-4o-mini NLU) via `useOnboardingVoice`. | Vapi assistant (same Path 1 runtime) — the overlay is a coached onboarding moment, so it belongs on Path 1 even though today it uses the legacy single-utterance pipeline. |
| Text mode: direct text submit (today's wiring is mixed). | callLLM via Path 3 (direct LLM) if the user is typing? **Decision pending** — see "Open question" below. |

**Open question:** if the chat overlay is showing both a typed input and a mic button, the typed branch could route through Path 3 (direct LLM) instead of opening Vapi. Worth deciding when migrating the overlay.

## Pre-onboarding screens — NOT Path 1

These screens appear in the onboarding flow timewise but are one-way broadcasts. Use Path 2 (MP3 when available, Sonic REST otherwise) — never Path 1.

| Screen | Why not Path 1 |
|---|---|
| SPLASH-01 (welcome hook) | One-way 8-second broadcast. Vapi session-minutes burn for nothing. |
| PREF-01 (voice preference ask) | Fixed text, no conversation. |
| MIC-01 (mic permission prompt) | Fixed text, no conversation. |
| POST-AUTH-01 (welcome intro) | Fixed text, no conversation. |

> **MP3 status (May 2026):** the pre-recorded MP3 assets for SPLASH/PREF/MIC/POST-AUTH may not all exist yet. Until they're generated, those screens fall through to live Sonic REST under Path 2. Either way, Path 1 is wrong for them.

## Live Cartesia Line consumers (today)

Every page above that lives in `src/pages/onboarding/` calls `useOnboardingAgent(screenId)` today. That hook is the migration boundary:

```tsx
// today
useOnboardingAgent('onboard_03');  // → useRealtimeVoice + Cartesia WebSocket

// target
useOnboardingAgent('onboard_03');  // → Vapi Web SDK call to assistant + screen metadata
```

The hook signature stays. The internals change. Pages don't need to know which provider runs underneath.

## What the overlay shares with full screens

`OnboardingChatOverlay` uses `useOnboardingVoice` (today) instead of `useOnboardingAgent`. After migration, both should converge on a single Vapi-backed hook. Don't add a third path here.

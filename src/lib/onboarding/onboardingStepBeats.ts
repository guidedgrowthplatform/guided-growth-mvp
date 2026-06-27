import type { OnboardingPath } from '@gg/shared/types';
import type { OnboardingCard } from './onboardingChatTypes';

// The chat IS onboarding — it renders at the onboarding root, not a sub-route.
export const ONBOARDING_CHAT_ROUTE = '/onboarding';

// The new flow-engine design renders the same chat-native surface at /onboarding/flow
// (orchestrator + data-driven renderer). It gets the same Vapi full-duplex treatment as
// the chat root, so the voice provider treats both as chat pages.
export const ONBOARDING_FLOW_ROUTE = '/onboarding/flow';

// Auth-free QA render of the flow-engine design. Same chat-native surface (so the voice
// engages here too), but with in-memory persistence so it runs without sign-in.
export const ONBOARDING_FLOW_PREVIEW_ROUTE = '/onboarding-flow-preview';

// Beats covered by Vapi full-duplex on the chat page: profile → fork → category
// → goals. The AUTH beat stays silent (like the routed screens). Single-field,
// server-step-advanced beats are armed; the habit beats (BEGINNER-03/04 share
// step 5 with a local select→schedule transition) and the plan/reflection/
// morning beats (step-model + bundle gaps) are arming in later phases. Widening
// this set keeps vapiShouldBeLive true across the added beats, so Vapi stays one
// continuous session through them instead of tearing down and cold-starting.
export const CHAT_VAPI_BEAT_SCREENS: ReadonlySet<string> = new Set([
  'ONBOARD-01--FORM',
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-04',
]);

// 'none' = chat-only beat (no inline card yet). Cards beyond profile land
// incrementally; the flow still works, the coach just drives that beat in chat.
export type BeatCardType = OnboardingCard['type'] | 'none';

export interface Beat {
  step: number;
  // Canonical screen_id — drives the opener, tool gating, and screen context.
  screenId: string;
  cardType: BeatCardType;
}

// current_step (+ path for the fork) → beat. screenIds match what the routed
// pages register, so openers and screen-context resolve identically. The step
// numbers are the server's canonical model (navigateNext.ts / saveStep(N)); the
// advanced/braindump path diverges at 3-5 and 7 onto its own screen_ids.
export function beatForStep(step: number, path: OnboardingPath | null): Beat {
  const s = step < 0 ? 0 : step;
  const advanced = path === 'braindump' || path === 'advanced';
  switch (s) {
    case 0:
      return { step: s, screenId: 'ONBOARD-AUTH--FORM', cardType: 'auth' };
    case 1:
      return { step: s, screenId: 'ONBOARD-01--FORM', cardType: 'profile' };
    case 2:
      return { step: s, screenId: 'ONBOARD-FORK--FORM', cardType: 'pathChoice' };
    case 3:
      // Advanced (braindump) captures free text — no inline card yet (Stage B
      // advanced); the coach drives it in chat.
      return advanced
        ? { step: s, screenId: 'ONBOARD-ADVANCED', cardType: 'none' }
        : { step: s, screenId: 'ONBOARD-BEGINNER-01', cardType: 'category' };
    case 4:
      return advanced
        ? { step: s, screenId: 'ONBOARD-ADVANCED-02', cardType: 'none' }
        : { step: s, screenId: 'ONBOARD-BEGINNER-02', cardType: 'goals' };
    case 5:
      return advanced
        ? { step: s, screenId: 'ONBOARD-ADVANCED-04', cardType: 'none' }
        : { step: s, screenId: 'ONBOARD-BEGINNER-03', cardType: 'habits' };
    case 6:
      // Advanced collapses habits+reflection at step 5 (ADVANCED-04), so its
      // step 6 is already the plan review — don't show a second reflection beat.
      return advanced
        ? { step: s, screenId: 'ONBOARD-ADVANCED-05', cardType: 'planReview' }
        : { step: s, screenId: 'ONBOARD-BEGINNER-07', cardType: 'reflection' };
    case 7:
    default:
      // Plan review / completion. Real screen_id (NOT STARTING-PLAN) so the
      // opener + confirm_plan tool resolve and the ONBOARD- chat gate passes.
      return advanced
        ? { step: 7, screenId: 'ONBOARD-ADVANCED-05', cardType: 'planReview' }
        : { step: 7, screenId: 'ONBOARD-BEGINNER-06', cardType: 'planReview' };
  }
}

// Inverse of beatForStep — maps a screen_id back to its step so coach-driven
// advancement on the chat page is idempotent (Math.max, not ++). Both fork
// branches map to the same step; sub-screen ids (BEGINNER-04/05/08, ADV-CUSTOM)
// are intentionally absent — they're sheets within a step, not steps.
const SCREEN_TO_STEP: Record<string, number> = {
  'ONBOARD-AUTH--FORM': 0,
  'ONBOARD-00--PREFS': 0,
  'ONBOARD-01--FORM': 1,
  'ONBOARD-01': 1,
  'ONBOARD-FORK--FORM': 2,
  'ONBOARD-FORK': 2,
  'ONBOARD-BEGINNER-01': 3,
  'ONBOARD-ADVANCED': 3,
  'ONBOARD-BEGINNER-02': 4,
  'ONBOARD-ADVANCED-02': 4,
  'ONBOARD-BEGINNER-03': 5,
  'ONBOARD-ADVANCED-04': 5,
  'ONBOARD-BEGINNER-07': 6,
  'ONBOARD-BEGINNER-06': 7,
  'ONBOARD-ADVANCED-05': 7,
  'STARTING-PLAN': 7,
};

export function stepForScreenId(screenId: string): number | undefined {
  return SCREEN_TO_STEP[screenId];
}

// One-shot data tools that COMPLETE their beat. A successful call auto-advances
// to the next beat the same way a card tap does — so a conversational save the
// coach narrates as "done" actually moves on, instead of stranding on a
// confirmation line waiting for the model to (unreliably) chain advance_step.
// Multi-item beats (add_habit/remove_habit/update_habit) are excluded — the
// coach decides when those are done. confirm_plan finalizes, it doesn't advance.
export const BEAT_COMPLETING_TOOLS: ReadonlySet<string> = new Set([
  'submit_profile',
  'submit_path_choice',
  'submit_category',
  'submit_goals',
  'submit_reflection_config',
  'submit_custom_prompts',
  'submit_brain_dump',
]);

// Tools whose successful call moves the beat forward. The coach's trailing line
// on such a turn is redundant (the next beat's opener carries the conversation),
// so the chat-native feed suppresses it deterministically off the turn's tool
// events — independent of the racy suppressTrailingRef flag.
export const ADVANCING_TOOL_NAMES: ReadonlySet<string> = new Set([
  'submit_profile',
  'submit_path_choice',
  'submit_category',
  'submit_goals',
  'submit_reflection_config',
  'submit_custom_prompts',
  'submit_brain_dump',
  'advance_step',
  'navigate_next',
]);

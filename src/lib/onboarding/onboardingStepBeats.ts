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

// Every onboarding beat with a coach voice turn is Vapi-capable. The runtime
// ONBOARDING_CHAT_VAPI gate decides whether these beats actually use Vapi.
export const CHAT_VAPI_BEAT_SCREENS: ReadonlySet<string> = new Set([
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-04',
  'ONBOARD-ADVANCED',
  'ONBOARD-BEGINNER-06',
  'ONBOARD-MORNING-SETUP',
  'ONBOARD-BEGINNER-07',
  'ONBOARD-COMPLETE',
]);

// Kept as an engineForTurn gate for future adapter-owned capture beats.
export const LOCAL_CAPTURE_BEATS: ReadonlySet<string> = new Set([]);

// 'none' = chat-only beat (no inline card yet). Cards beyond profile land
// incrementally; the flow still works, the coach just drives that beat in chat.
export type BeatCardType = OnboardingCard['type'] | 'none';

export interface Beat {
  step: number;
  // Canonical screen_id — drives the opener, tool gating, and screen context.
  screenId: string;
  cardType: BeatCardType;
}

// current_step (+ path for the fork) → beat, on the V3 persist-step scale (the
// step each beat SAVES: profile 1, fork 2, category/braindump 3, goals/frequency
// 4, habit-select+schedule 5, state-check 6, morning-setup 7, reflection 8 —
// non-monotonic vs flow order, see useFlowOrchestrator's resume notes). Parity
// with the generated flow is locked by stepMapParity.test.ts.
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
        ? { step: s, screenId: 'ONBOARD-ADVANCED-FREQUENCY', cardType: 'none' }
        : { step: s, screenId: 'ONBOARD-BEGINNER-02', cardType: 'goals' };
    case 5:
      return { step: s, screenId: 'ONBOARD-BEGINNER-03', cardType: 'habits' };
    case 6:
      // V3 pre-fork setup beats: the flow renderer owns their cards; the chat
      // feed attaches none.
      return { step: s, screenId: 'ONBOARD-STATE-CHECK', cardType: 'none' };
    case 7:
      return { step: s, screenId: 'ONBOARD-MORNING-SETUP', cardType: 'none' };
    case 8:
    default:
      return { step: 8, screenId: 'ONBOARD-BEGINNER-07', cardType: 'reflection' };
  }
}

// Inverse of beatForStep on the same V3 persist-step scale — maps a screen_id
// back to the step its beat saves, so coach-driven advancement is idempotent
// (Math.max, not ++). Both fork lanes map to the same step; habit-select and
// habit-schedule share 5 (the V3 two-5s).
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
  'ONBOARD-ADVANCED-FREQUENCY': 4,
  'ONBOARD-BEGINNER-03': 5,
  'ONBOARD-BEGINNER-04': 5,
  'ONBOARD-ADVANCED-04': 5,
  'ONBOARD-STATE-CHECK': 6,
  'ONBOARD-MORNING-SETUP': 7,
  'ONBOARD-BEGINNER-07': 8,
  // Legacy plan-review ids (V3 has no plan-review beat — into-app follows
  // habit-schedule): mapped past the scale so a navigate_next never rewinds.
  'ONBOARD-BEGINNER-06': 9,
  'ONBOARD-ADVANCED-05': 9,
  'STARTING-PLAN': 9,
};

export function stepForScreenId(screenId: string): number | undefined {
  return SCREEN_TO_STEP[screenId];
}

// One-shot data tools that COMPLETE their beat. A successful call auto-advances
// to the next beat the same way a card tap does — so a conversational save the
// coach narrates as "done" actually moves on, instead of stranding on a
// confirmation line waiting for the model to (unreliably) chain advance_step.
// Multi-item beats (add_habit/remove_habit/update_habit) are excluded — the
// coach decides when those are done. submit_custom_prompts is a MID-beat save
// (reflection completes on submit_reflection_config, which carries the
// schedule). confirm_plan finalizes, it doesn't advance.
export const BEAT_COMPLETING_TOOLS: ReadonlySet<string> = new Set([
  'submit_profile',
  'submit_path_choice',
  'submit_category',
  'submit_goals',
  'record_checkin',
  'submit_morning_checkin',
  'submit_reflection_config',
  'submit_brain_dump',
]);

// The beat each completing tool belongs to. The optimistic advance fires only
// when the tool's own beat is still the ACTIVE one — a tool racing in after the
// user already tapped past (card tap + voice answer on the same beat) must not
// push the NEXT beat forward with an empty capture. Parity with the generated
// flow's node.tool.toolName is locked by stepMapParity.test.ts.
export const BEAT_COMPLETING_TOOL_SCREEN: Readonly<Record<string, string>> = {
  submit_profile: 'ONBOARD-01--FORM',
  submit_path_choice: 'ONBOARD-FORK--FORM',
  submit_category: 'ONBOARD-BEGINNER-01',
  submit_goals: 'ONBOARD-BEGINNER-02',
  record_checkin: 'ONBOARD-STATE-CHECK',
  submit_morning_checkin: 'ONBOARD-MORNING-SETUP',
  submit_reflection_config: 'ONBOARD-BEGINNER-07',
  submit_brain_dump: 'ONBOARD-ADVANCED',
};

// Tools whose successful call moves the beat forward. The coach's trailing line
// on such a turn is redundant (the next beat's opener carries the conversation),
// so the chat-native feed suppresses it deterministically off the turn's tool
// events — independent of the racy suppressTrailingRef flag.
export const ADVANCING_TOOL_NAMES: ReadonlySet<string> = new Set([
  'submit_profile',
  'submit_path_choice',
  'submit_category',
  'submit_goals',
  'record_checkin',
  'submit_morning_checkin',
  'submit_reflection_config',
  'submit_brain_dump',
  'advance_step',
  'navigate_next',
]);

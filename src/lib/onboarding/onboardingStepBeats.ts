import { DERIVED_STEP_MAPS } from '@/onboarding-flow/derivedStepMaps';
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

// Chat card per engine componentType. 'none' beats: the flow renderer owns the
// card (V3 pre-fork setup) or the coach drives it in chat (advanced lane).
const CARD_TYPE_BY_COMPONENT: Record<string, BeatCardType> = {
  auth: 'auth',
  'profile-input': 'profile',
  'path-selection': 'pathChoice',
  'category-grid': 'category',
  'goals-list': 'goals',
  'habit-picker': 'habits',
  'habit-schedule': 'habits',
  'advanced-capture': 'none',
  'advanced-frequency': 'none',
  'state-check': 'none',
  'morning-checkin-setup': 'none',
  'reflection-card': 'reflection',
  'weekly-day-picker': 'none',
};

// current_step (+ path for the fork) → beat. Screens + owners derived from the
// generated flow (L1-3); the V3 scale stays non-monotonic vs flow order, see
// useFlowOrchestrator's resume notes. Locked by stepMapParity.test.ts.
export function beatForStep(step: number, path: OnboardingPath | null): Beat {
  const s = step < 0 ? 0 : step;
  const advanced = path === 'braindump' || path === 'advanced';
  if (s === 0) return { step: s, screenId: 'ONBOARD-AUTH--FORM', cardType: 'auth' };
  const lane = advanced ? 'braindump' : 'simple';
  const screens = DERIVED_STEP_MAPS.stepScreens[s];
  const owners = DERIVED_STEP_MAPS.stepOwners[s];
  const screenId = screens?.[lane] ?? screens?.[advanced ? 'simple' : 'braindump'];
  const component = owners?.[lane] ?? owners?.[advanced ? 'simple' : 'braindump'];
  if (screenId && component) {
    return { step: s, screenId, cardType: CARD_TYPE_BY_COMPONENT[component] ?? 'none' };
  }
  // Past the scale (legacy alias ids) or a gap: clamp to the last identity beat,
  // card type from that beat's owning component.
  const max = DERIVED_STEP_MAPS.maxStep;
  const maxScreens = DERIVED_STEP_MAPS.stepScreens[max];
  const maxOwners = DERIVED_STEP_MAPS.stepOwners[max];
  const maxComponent = maxOwners?.simple ?? maxOwners?.braindump;
  return {
    step: max,
    screenId: maxScreens?.simple ?? maxScreens?.braindump ?? 'ONBOARD-WEEKLY-SETUP',
    cardType: maxComponent ? (CARD_TYPE_BY_COMPONENT[maxComponent] ?? 'none') : 'none',
  };
}

// Inverse of beatForStep on the same scale — canonical entries derived from the
// generated flow; the alias tail below covers ids the flow no longer carries.
// Coach-driven advancement stays idempotent (Math.max, not ++).
const LEGACY_SCREEN_STEP_ALIASES: Record<string, number> = {
  'ONBOARD-AUTH--FORM': 0,
  'ONBOARD-00--PREFS': 0,
  'ONBOARD-01': 1,
  'ONBOARD-FORK': 2,
  'ONBOARD-ADVANCED-02': 4,
  'ONBOARD-ADVANCED-04': 5,
  // Legacy plan-review ids (V3 has no plan-review beat — into-app follows
  // habit-schedule): mapped past the scale (now 10, since 9 is a real V3 beat)
  // so a navigate_next never rewinds.
  'ONBOARD-BEGINNER-06': 10,
  'ONBOARD-ADVANCED-05': 10,
  'STARTING-PLAN': 10,
};

const SCREEN_TO_STEP: Record<string, number> = {
  ...LEGACY_SCREEN_STEP_ALIASES,
  ...DERIVED_STEP_MAPS.screenToStep,
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

// The beat each completing tool belongs to, derived from the generated flow's
// node.tool.toolName (L1-3). The optimistic advance fires only when the tool's
// own beat is still the ACTIVE one — a tool racing in after the user already
// tapped past must not push the NEXT beat forward with an empty capture.
export const BEAT_COMPLETING_TOOL_SCREEN: Readonly<Record<string, string>> = Object.fromEntries(
  [...BEAT_COMPLETING_TOOLS]
    .map((tool) => [tool, DERIVED_STEP_MAPS.toolScreen[tool]])
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
);

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

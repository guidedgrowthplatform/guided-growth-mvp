/**
 * Pure helper that converts an OnboardingVoiceResult into the next
 * mutation Step5Page should apply to its habit-picker state.
 *
 * Extracted from Step5Page.handleVoiceAction so the routing logic for
 * `add_habit` / `select_option` can be unit-tested without mounting
 * the page. The page itself stays the only place that owns the
 * setState / analytics calls; this helper just decides WHICH bucket
 * the spoken habit name belongs in:
 *
 *   - 'toggle'    → the spoken name matches a predefined picker option
 *                   for one of the user's goals (use existing
 *                   toggleHabit path).
 *   - 'addCustom' → name is not in any predefined list → it's a
 *                   custom habit, drop it into the currently-expanded
 *                   goal section so the picker actually renders it.
 *   - 'noop'      → guard hit (empty name, max already selected,
 *                   already selected, unsupported action).
 *
 * Why this matters: before the helper, handleVoiceAction always
 * called toggleHabit(name). For custom names (e.g. user says
 * "meditation" on the Sleep goal whose predefined list doesn't
 * include it), the picker would have nothing to render — selectedHabits
 * would get the entry but the UI never showed it, so the user would
 * tap Continue with zero visible habits and the flow restarted from
 * category. See gg-spec/screens/ONBOARD-BEGINNER-03.md "Custom habits
 * allowed - capture name via voice/text."
 */
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';

export interface HabitVoiceState {
  /** Goals selected for this onboarding session, in display order. */
  goals: string[];
  /** Map of goal -> predefined picker habits. */
  habitsByGoal: Record<string, string[]>;
  /** Habits the user already has selected (capped at 2). */
  selectedHabits: Set<string>;
  /** Map of goal -> custom habits already added under that goal. */
  customHabits: Record<string, string[]>;
  /**
   * The goal section currently expanded in the picker. May be ''
   * when the user has collapsed everything — we fall back to
   * goals[0] for custom adds in that case.
   */
  expandedGoal: string;
  /**
   * Product cap on selected habits. Defaults to MAX_HABITS_ONBOARDING
   * so callers don't have to thread the constant explicitly.
   */
  maxSelected?: number;
}

export type HabitVoiceUpdate =
  | { kind: 'noop'; reason: NoopReason }
  // `goal` is the goal whose section the toggled chip lives in — caller
  // expands it so a hit under a collapsed/other goal becomes visible.
  | { kind: 'toggle'; name: string; goal: string }
  | { kind: 'addCustom'; goal: string; name: string };

export type NoopReason =
  | 'unsupported-action'
  | 'empty-name'
  | 'already-selected'
  | 'max-reached'
  | 'no-goal-available';

function extractName(params: Record<string, unknown>): string {
  // Vapi tool args use `name`; legacy parser-style params use `value`.
  // toolEventToVoiceActions.ts populates BOTH for add_habit so either
  // works, but we keep the fallback for select_option which only
  // carries `value`.
  if (typeof params.name === 'string') return params.name.trim();
  if (typeof params.value === 'string') return params.value.trim();
  return '';
}

/**
 * Case-insensitive scan of every goal's predefined picker options.
 * Returns the CANONICAL option string + the goal it lives under, or
 * null if no match. Canonicalizing is what lets the caller's
 * toggleHabit find the row even when STT delivers a lowercased name.
 */
function findCanonicalOption(
  name: string,
  goals: string[],
  habitsByGoal: Record<string, string[]>,
): { name: string; goal: string } | null {
  const needle = name.toLowerCase();
  for (const g of goals) {
    const list = habitsByGoal[g];
    if (!list) continue;
    const hit = list.find((h) => h.toLowerCase() === needle);
    if (hit) return { name: hit, goal: g };
  }
  return null;
}

/**
 * Locate a custom habit the user has already added. Returns the goal
 * it's cataloged under (the one the picker renders it inside) so a
 * voice re-add of a deselected custom can re-toggle the right row.
 */
function findCustomGoal(
  name: string,
  customHabits: Record<string, string[]>,
): { name: string; goal: string } | null {
  const needle = name.toLowerCase();
  for (const [goal, list] of Object.entries(customHabits)) {
    const hit = list.find((h) => h.toLowerCase() === needle);
    if (hit) return { name: hit, goal };
  }
  return null;
}

/**
 * Decide what to do with an `add_habit` / `select_option` voice
 * result. Returns 'noop' for any other action so the caller can
 * keep its remove_habit / update_habit branches intact.
 */
export function deriveHabitVoiceUpdate(
  state: HabitVoiceState,
  result: OnboardingVoiceResult,
): HabitVoiceUpdate {
  if (result.action !== 'add_habit' && result.action !== 'select_option') {
    return { kind: 'noop', reason: 'unsupported-action' };
  }

  const params = result.params as Record<string, unknown>;
  const name = extractName(params);
  if (!name) return { kind: 'noop', reason: 'empty-name' };
  const maxSelected = state.maxSelected ?? MAX_HABITS_ONBOARDING;

  // Case-insensitive idempotency: STT may lowercase the spoken name
  // even when the picker row stores it in canonical casing.
  const needle = name.toLowerCase();
  const alreadySelected = [...state.selectedHabits].some((h) => h.toLowerCase() === needle);
  if (alreadySelected) {
    return { kind: 'noop', reason: 'already-selected' };
  }
  if (state.selectedHabits.size >= maxSelected) {
    return { kind: 'noop', reason: 'max-reached' };
  }

  // Predefined picker hit → toggle path. Return the CANONICAL option
  // string (not the spoken casing) so toggleHabit finds the right row
  // even when STT lowercases everything. We also return the matched
  // goal so the caller can auto-expand it if the chip lives under a
  // currently-collapsed section — otherwise the toggle would land
  // invisibly (Edge 1 from the #161 review).
  const optionHit = findCanonicalOption(name, state.goals, state.habitsByGoal);
  if (optionHit) {
    return { kind: 'toggle', name: optionHit.name, goal: optionHit.goal };
  }

  // Custom already in customHabits but NOT in selectedHabits → the user
  // deselected it earlier and is voicing it again. Re-toggle the
  // existing row (don't noop, don't double-add). Edge 3 from the #161
  // review.
  const customHit = findCustomGoal(name, state.customHabits);
  if (customHit) {
    return { kind: 'toggle', name: customHit.name, goal: customHit.goal };
  }

  // Brand-new custom habit. Default to the currently-expanded goal so
  // the chip lands somewhere visible. Fall back to goals[0] when
  // everything's collapsed; noop if no goals exist.
  const fallbackGoal = state.expandedGoal || state.goals[0];
  if (!fallbackGoal) return { kind: 'noop', reason: 'no-goal-available' };

  return { kind: 'addCustom', goal: fallbackGoal, name };
}

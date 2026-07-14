// Onboarding advance/finalize data guards. checkAdvanceData is shared by the
// Direct-LLM advance_step handler AND Vapi's navigate_next (see
// api/_lib/vapi/handlers/navigateNext.ts), so a gate change here applies to
// both voice lanes.
import { isAdvancedPath } from '../tools.onboarding.js';
import { ADVANCE_GATE_OWNERS, STEP_OWNERS } from './stepMaps.generated.js';

type Gate = (
  data: Record<string, unknown>,
  path: string | null,
  brainDumpRaw: string | null,
) => string | null;

const habitsGate: Gate = (data) => {
  const habits = data.habitConfigs as Record<string, unknown> | undefined;
  if (!habits || Object.keys(habits).length === 0) {
    return 'habits_missing: call add_habit at least once first';
  }
  return null;
};

// Step 3 on either lane: category (beginner) or the brain dump (advanced) counts.
const categoryOrBrainDumpGate: Gate = (data, _path, brainDumpRaw) => {
  if (!data.category && !(typeof brainDumpRaw === 'string' && brainDumpRaw.length > 0)) {
    return 'category_or_braindump_missing: call submit_category (beginner) or submit_brain_dump (advanced) first';
  }
  return null;
};

// Data gate per beat componentType. WHICH beat gates a step comes from the
// generated flow (STEP_OWNERS); gate wording is owned by the context lane.
const GATES: Record<string, Gate> = {
  'profile-input': (data) => {
    // nickname captured at auth; this beat gates on age+gender only.
    if (!data.age) return 'age_missing: call submit_profile with age first';
    if (!data.gender)
      return 'gender_missing: call submit_profile with gender (Male | Female | Other) — gender is required and cannot be skipped';
    return null;
  },
  'path-selection': (_data, path) => (!path ? 'path_missing: call submit_path_choice first' : null),
  'category-grid': categoryOrBrainDumpGate,
  'advanced-capture': categoryOrBrainDumpGate,
  'goals-list': (data) => {
    if (!Array.isArray(data.goals) || data.goals.length === 0) {
      return 'goals_missing: call submit_goals first (with the chosen goals)';
    }
    return null;
  },
  // Advanced-frequency schedules the parsed habits — gate on habitConfigs, not goals.
  'advanced-frequency': habitsGate,
  'habit-picker': habitsGate,
  'habit-schedule': habitsGate,
  'state-check': (data) => {
    // record_checkin (voice) writes stateCheck; the card tap writes checkin.
    if (!data.stateCheck && !data.checkin) {
      return 'state_check_missing: call record_checkin first (at least one of sleep/mood/energy/stress)';
    }
    return null;
  },
  // B58 follow-up: an explicit refusal (config_refused_by_user) persists
  // morningCheckinSkipped=true as a terminal answer — without a skip path the
  // beat is inescapable and the model retries submit_morning_checkin on later
  // turns, where unrelated time/day content can slip past the guard and save a
  // config the user already declined.
  'morning-checkin-setup': (data) =>
    !data.morningCheckin && data.morningCheckinSkipped !== true
      ? 'morning_checkin_missing: call submit_morning_checkin first'
      : null,
  'reflection-card': (data) =>
    !data.reflectionConfig ? 'reflection_missing: call submit_reflection_config first' : null,
  'weekly-day-picker': (data) =>
    !data.weeklyConfig ? 'weekly_config_missing: call submit_weekly_config first' : null,
};

// Per-step data preconditions for a FORWARD advance (sourceStep → sourceStep+1).
// Returns the missing-field message, or null if the precondition passes. Back-nav
// (target <= current) is always allowed — callers only check forward advances.
// The step→beat table is derived from the generated flow (L1-3); the V3 scale
// stays non-monotonic vs flow order (1,6,7,8,9,2,3,4,5,5 — identities, not
// positions). Steps past the scale (legacy 10+ ids) have no V3 beat: nothing to gate.
export function checkAdvanceData(args: {
  sourceStep: number;
  data: Record<string, unknown>;
  path: string | null;
  brainDumpRaw: string | null;
}): string | null {
  const { sourceStep, data, path, brainDumpRaw } = args;
  // Canonical-first: data.path (canonical) wins over the legacy column.
  const advanced = isAdvancedPath((data.path as string | undefined) ?? path);
  // The stored step runs one AHEAD of the identity scale across shared persist
  // steps (habit-select + habit-schedule both persist 5, so habit-schedule is
  // stored as 6). Gate on the beat actually being LEFT at this stored step
  // (ADVANCE_GATE_OWNERS, lane-aware), falling back to the identity owner where
  // no window beat displays there. B50: the old identity-only lookup gated the
  // habit-schedule advance (6 to 7) on state-check data, which cannot exist yet
  // (state-check is the NEXT beat), telling the model to call record_checkin on
  // a beat where that tool is not exposed. Cornered, it rerouted the check-in
  // into add_habit and hit max_habits_reached ("habit limit reached").
  const laneKey = advanced ? 'braindump' : 'simple';
  const gateOwner = ADVANCE_GATE_OWNERS[sourceStep]?.[laneKey];
  const owners = STEP_OWNERS[sourceStep];
  const identityOwner = owners
    ? advanced
      ? (owners.braindump ?? owners.simple)
      : (owners.simple ?? owners.braindump)
    : undefined;
  const component = gateOwner ?? identityOwner;
  const gate = component ? GATES[component] : undefined;
  return gate ? gate(data, path, brainDumpRaw) : null;
}

// STEP-0 instrumentation: when ONBOARDING_STEP_TRACE=1, emit one parseable line per
// ACCEPTED advance so a single onboarding run reconstructs the current_step climb +
// the data present at each step (see docs/step-0-canonical-step-table.md). Silent
// (zero overhead) otherwise. Rejections already log via the handlers' reject lines.
export function traceAdvanceStep0(
  source: 'vapi' | 'direct',
  args: {
    currentStep: number;
    targetStep: number;
    data: Record<string, unknown>;
    path: string | null;
    brainDumpRaw: string | null;
  },
): void {
  if (process.env.ONBOARDING_STEP_TRACE !== '1') return;
  const { currentStep, targetStep, data, path, brainDumpRaw } = args;
  const habits = data.habitConfigs as Record<string, unknown> | undefined;
  const has = {
    nickname: !!data.nickname,
    path: !!path,
    category: !!data.category,
    goals: Array.isArray(data.goals) && data.goals.length > 0,
    habitConfigs: !!habits && Object.keys(habits).length > 0,
    morningCheckin: !!data.morningCheckin,
    morningCheckinSkipped: data.morningCheckinSkipped === true,
    reflectionConfig: !!data.reflectionConfig,
    weeklyConfig: !!data.weeklyConfig,
    brainDump: typeof brainDumpRaw === 'string' && brainDumpRaw.length > 0,
  };
  console.log(
    `[step0] src=${source} current=${currentStep} target=${targetStep} has=${JSON.stringify(has)}`,
  );
}

// Plan-review finalize precondition: habits (beginner or advanced) + reflection saved.
export function checkPlanReady(data: Record<string, unknown>): {
  hasHabits: boolean;
  hasReflection: boolean;
} {
  const habitConfigs = data.habitConfigs as Record<string, unknown> | undefined;
  const advancedHabitConfigs = data.advancedHabitConfigs as Record<string, unknown> | undefined;
  const hasHabits =
    (!!habitConfigs && Object.keys(habitConfigs).length > 0) ||
    (!!advancedHabitConfigs && Object.keys(advancedHabitConfigs).length > 0);
  return { hasHabits, hasReflection: !!data.reflectionConfig };
}

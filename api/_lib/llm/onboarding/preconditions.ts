// Direct-LLM onboarding advance/finalize guards, shared by advance_step + confirm_plan.
// (Vapi's navigate_next/confirm_plan keep their own copies — that path is left untouched.)

// Per-step data preconditions for a FORWARD advance (sourceStep → sourceStep+1).
// Returns the missing-field message, or null if the precondition passes. Back-nav
// (target <= current) is always allowed — callers only check forward advances.
export function checkAdvanceData(args: {
  sourceStep: number;
  data: Record<string, unknown>;
  path: string | null;
  brainDumpRaw: string | null;
}): string | null {
  const { sourceStep, data, path, brainDumpRaw } = args;
  switch (sourceStep) {
    case 1:
      if (!data.nickname) return 'profile_missing: call submit_profile (nickname required) first';
      if (!data.gender)
        return 'gender_missing: call submit_profile with gender (Male | Female | Other) — gender is required and cannot be skipped';
      return null;
    case 2:
      if (!path) return 'path_missing: call submit_path_choice first';
      return null;
    case 3:
      if (!data.category && !(typeof brainDumpRaw === 'string' && brainDumpRaw.length > 0)) {
        return 'category_or_braindump_missing: call submit_category (beginner) or submit_brain_dump (advanced) first';
      }
      return null;
    case 4:
      if (!Array.isArray(data.goals) || data.goals.length === 0) {
        return 'goals_missing: call submit_goals first (with the chosen goals)';
      }
      return null;
    // Steps 5 and 6 are the two habit beats (habit-select + habit-schedule), both
    // gated on habitConfigs — see docs/step-0-canonical-step-table.md. The merged
    // resync tail is 5→6→7→8→9→10 (NOT the old reflection=6/plan=7 tail).
    case 5:
    case 6: {
      const habits = data.habitConfigs as Record<string, unknown> | undefined;
      if (!habits || Object.keys(habits).length === 0) {
        return 'habits_missing: call add_habit at least once first';
      }
      return null;
    }
    case 7:
      // Leaving plan-review — a display/confirm beat with no new data to gate on.
      return null;
    case 8:
      if (!data.morningCheckin) {
        return 'morning_checkin_missing: call submit_morning_checkin first';
      }
      return null;
    case 9:
      if (!data.reflectionConfig) {
        return 'reflection_missing: call submit_reflection_config first';
      }
      return null;
    default:
      return null;
  }
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
    reflectionConfig: !!data.reflectionConfig,
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

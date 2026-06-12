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
    case 5: {
      const habits = data.habitConfigs as Record<string, unknown> | undefined;
      if (!habits || Object.keys(habits).length === 0) {
        return 'habits_missing: call add_habit at least once first';
      }
      return null;
    }
    case 6:
      if (!data.reflectionConfig) {
        return 'reflection_missing: call submit_reflection_config first';
      }
      return null;
    default:
      return null;
  }
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

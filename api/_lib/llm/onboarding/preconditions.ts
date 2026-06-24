// Per-step onboarding advance/finalize guards. Shared by the Direct-LLM
// advance_step/confirm_plan path AND Vapi's navigate_next (which imports
// checkAdvanceData) so a beat advances IDENTICALLY whichever engine drives it.

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
    case 0:
      // Beat-0 preference is client-only — no server data lands at step 0.
      // The real opener-turn ban on advance_step lives in buildSystemPrompt
      // OPENER_INSTRUCTIONS (out of scope here).
      return null;
    case 1:
      if (!data.nickname || data.age == null || !data.gender) {
        return 'profile_missing: call submit_profile (nickname, age, gender required) first';
      }
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
      // Advanced (braindump) path has no goals — it captured a brain dump at
      // step 3 and configures habits at step 5. Gate it on the brain dump
      // instead so coach-driven advance isn't hard-blocked on a key it never
      // writes. Beginner path still requires goals.
      if (path === 'braindump') {
        if (typeof brainDumpRaw === 'string' && brainDumpRaw.length > 0) return null;
        return 'braindump_missing: call submit_brain_dump first';
      }
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

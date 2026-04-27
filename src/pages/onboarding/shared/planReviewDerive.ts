/**
 * Rehydrate a PlanReviewState from the persisted onboarding_states row
 * when the agent-driven navigation brings the user to step-7 without a
 * router location.state payload.
 *
 * The agent's `update_onboarding_data` tool writes habitConfigs +
 * reflectionConfig into onboarding_states.data during ONBOARD-05/06/08,
 * so by the time the user lands on PlanReviewPage the row is complete
 * enough for this function to reconstruct what the tap-flow would have
 * carried via navigate(state).
 *
 * Lives in its own module so (a) it can be unit-tested without React and
 * (b) PlanReviewPage.tsx satisfies the react-refresh rule of
 * components-only exports.
 */
export interface PlanReviewHabitConfig {
  days: number[];
  time: string;
  reminder: boolean;
}

export interface PlanReviewReflectionConfig {
  time: string;
  days: number[];
  reminder: boolean;
  schedule: string;
}

export interface PlanReviewState {
  habitConfigs: Record<string, PlanReviewHabitConfig>;
  goals?: string[];
  category?: string;
  reflectionConfig: PlanReviewReflectionConfig;
  source?: 'advanced';
}

export function deriveStateFromOnboarding(input: unknown): PlanReviewState | null {
  if (!input || typeof input !== 'object') return null;
  const data = input as Record<string, unknown>;
  const rawConfigs = data.habitConfigs;
  if (!rawConfigs || typeof rawConfigs !== 'object') return null;

  const habitConfigs: PlanReviewState['habitConfigs'] = {};
  for (const [name, cfg] of Object.entries(rawConfigs)) {
    if (!cfg || typeof cfg !== 'object') continue;
    const daysInput = (cfg as { days?: unknown }).days;
    const days = Array.isArray(daysInput)
      ? (daysInput.filter((d) => typeof d === 'number') as number[])
      : daysInput instanceof Set
        ? Array.from(daysInput as Set<number>)
        : [];
    habitConfigs[name] = {
      days,
      time: String((cfg as { time?: unknown }).time ?? ''),
      reminder: Boolean((cfg as { reminder?: unknown }).reminder),
    };
  }
  if (Object.keys(habitConfigs).length === 0) return null;

  const rc = data.reflectionConfig;
  if (!rc || typeof rc !== 'object') return null;
  const reflectionConfig: PlanReviewReflectionConfig = {
    time: String((rc as { time?: unknown }).time ?? ''),
    days: Array.isArray((rc as { days?: unknown }).days)
      ? ((rc as { days: unknown[] }).days.filter((d) => typeof d === 'number') as number[])
      : [],
    reminder: Boolean((rc as { reminder?: unknown }).reminder),
    schedule: String((rc as { schedule?: unknown }).schedule ?? ''),
  };

  return {
    habitConfigs,
    reflectionConfig,
    goals: Array.isArray(data.goals) ? (data.goals as string[]) : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
  };
}

/**
 * habitSelectionRules — the goals->habits branch rule (Lane A A5,
 * onboarding-consolidation-plan-2026-07-06; the spec rule from the beat
 * context): TWO goals = one habit per goal (two total, one each); ONE goal =
 * one or two habits. Pure module so the rule is unit-testable apart from the
 * picker UI.
 *
 * Two-goal selection uses REPLACE semantics inside a goal: picking a second
 * habit under the same goal swaps it for the previous pick instead of dead
 * blocking the tap. Habits not found in any goal's option list (voice-added
 * customs) attribute to the currently expanded goal.
 *
 * NO EM DASHES.
 */

export interface HabitSelectionArgs {
  prev: ReadonlySet<string>;
  habit: string;
  /** The user's picked goals (1 or 2). */
  goals: string[];
  /** goal -> its option list (flowData's habitsByGoal). */
  habitsByGoal: Record<string, string[]>;
  /** The panel currently open; attribution fallback for custom names. */
  expandedGoal: string;
  /** The single-goal cap (MAX_HABITS_ONBOARDING). */
  maxTotal: number;
}

function goalOf(
  habit: string,
  goals: string[],
  habitsByGoal: Record<string, string[]>,
  expandedGoal: string,
): string {
  return goals.find((g) => (habitsByGoal[g] ?? []).includes(habit)) ?? expandedGoal;
}

/** The next selection after toggling `habit`. Enforces the branch rule. */
export function nextHabitSelection(args: HabitSelectionArgs): Set<string> {
  const { prev, habit, goals, habitsByGoal, expandedGoal, maxTotal } = args;
  const next = new Set(prev);
  if (next.has(habit)) {
    next.delete(habit);
    return next;
  }
  const onePerGoal = goals.length >= 2;
  if (onePerGoal) {
    const g = goalOf(habit, goals, habitsByGoal, expandedGoal);
    for (const h of next) {
      if (goalOf(h, goals, habitsByGoal, expandedGoal) === g) next.delete(h);
    }
    next.add(habit);
    return next;
  }
  if (next.size < maxTotal) next.add(habit);
  return next;
}

import { goalsByCategory } from '@gg/shared/data/onboardingGoals';
import { habitsByGoal } from '@gg/shared/data/onboardingHabits';

function formatOptions(rows: [string, string[]][]): string {
  return rows.map(([label, items]) => `- ${label}: ${items.join(' | ')}`).join('\n');
}

// Inject canonical labels from the shared taxonomy — the DB context_block can drift
// out of sync, leaving the coach to invent goals/habits that don't match the form.
export function buildCanonicalOptionsBlock(
  screenId: string,
  data: Record<string, unknown>,
): string {
  const category = typeof data.category === 'string' ? data.category : null;
  const goals = Array.isArray(data.goals)
    ? data.goals.filter((g): g is string => typeof g === 'string')
    : [];

  if (screenId === 'ONBOARD-BEGINNER-02') {
    const rows: [string, string[]][] =
      category && goalsByCategory[category]
        ? [[category, goalsByCategory[category]]]
        : Object.entries(goalsByCategory);
    return (
      `\n\n## Goal Options${category ? ` (category: ${category})` : ''}\n` +
      `Offer ONLY these goals, verbatim — never invent, rename, or paraphrase. Save using these exact labels.\n` +
      formatOptions(rows)
    );
  }

  if (screenId === 'ONBOARD-BEGINNER-03') {
    const source = goals.length ? goals : category ? (goalsByCategory[category] ?? []) : [];
    const rows: [string, string[]][] = source
      .filter((g) => habitsByGoal[g])
      .map((g) => [g, habitsByGoal[g]]);
    if (rows.length === 0) return '';
    return (
      `\n\n## Habit Options by Goal\n` +
      `Suggest habits ONLY from this list, verbatim, for the user's goal(s). Do not invent or rename them.\n` +
      formatOptions(rows)
    );
  }

  return '';
}

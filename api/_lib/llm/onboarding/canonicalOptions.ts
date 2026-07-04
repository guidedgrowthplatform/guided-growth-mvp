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

  if (screenId === 'ONBOARD-01--FORM') {
    return (
      `\n\n## Profile Fields\n` +
      `The user's name is already known from sign-in, so do NOT ask for it, and do NOT ask how they heard about us (no referral source). Collect two things, both required: age and gender (Male | Female | Other). Gender is required; always collect it and never let the user skip or decline it.\n` +
      `Call submit_profile as fields come in — pass every field gathered so far (include the already-known nickname only if you have it; it is optional).\n` +
      `Call advance_step only once BOTH age and gender are in. Do not block advance on a referral source.`
    );
  }

  if (screenId === 'ONBOARD-BEGINNER-02') {
    const rows: [string, string[]][] =
      category && goalsByCategory[category]
        ? [[category, goalsByCategory[category]]]
        : Object.entries(goalsByCategory);
    return (
      `\n\n## Subcategory Options${category ? ` (category: ${category})` : ''}\n` +
      `Offer ONLY these subcategories, verbatim — never invent, rename, or paraphrase. Save using these exact labels.\n` +
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
      `\n\n## Habit Options by Subcategory\n` +
      `Suggest habits ONLY from this list, verbatim, for the user's subcategory(ies). Do not invent or rename them.\n` +
      formatOptions(rows)
    );
  }

  return '';
}

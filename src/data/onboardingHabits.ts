/**
 * Single source of truth for onboarding categories → subcategories → habits.
 * Sourced from the approved Google Sheet.
 */

// goalsByCategory + habitsByGoal live in @gg/shared so the serverless handlers
// and system-prompt builder share the same taxonomy. Re-exported for frontend imports.
export { goalsByCategory } from '@gg/shared/data/onboardingGoals';
export { habitsByGoal } from '@gg/shared/data/onboardingHabits';

// Product cap on habits selectable during onboarding. Spec is still 1–3
// pending Yair; we're holding at 2 in code and consolidating to one
// constant so a future change only edits here.
export const MAX_HABITS_ONBOARDING = 2;

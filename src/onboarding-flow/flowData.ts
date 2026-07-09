/**
 * Option data for the data-driven beats. Single source of truth shared between
 * the live Step pages' data and the flow renderer.
 *
 * `goalsByCategory` and `habitsByGoal` are re-exported from the existing
 * `@/data/onboardingHabits` module so the renderer and the old pages never
 * drift. The category list is mirrored here because it lives inline in
 * Step3Page today (not exported); keep the two in sync until the page is
 * migrated onto the renderer.
 */
export { goalsByCategory, habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';

export interface FlowCategory {
  label: string;
  image: string;
}

/** Mirror of the inline `categories` constant in Step3Page.tsx. */
export const FLOW_CATEGORIES: FlowCategory[] = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
  { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
  { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
  { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
  { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
  { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
  { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
];

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const REFERRAL_OPTIONS = ['Founder Invite', 'Webinar', 'Friend', 'Other'];

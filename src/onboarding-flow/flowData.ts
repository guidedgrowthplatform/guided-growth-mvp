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

// Women's art variant (Yair-ruled 2026-07-06): a render-time asset swap on the
// SAME category screen when the user's gender answer is 'Female'. Men, non-binary
// ('Other') and undisclosed (null/undefined) all keep the default art. Keyed by
// category label; slugs mirror the female webp set in public/images/onboarding/female.
const FEMALE_CATEGORY_ART: Record<string, string> = {
  'Sleep better': '/images/onboarding/female/sleep-better.webp',
  'Move more': '/images/onboarding/female/move-more.webp',
  'Eat better': '/images/onboarding/female/eat-better.webp',
  'Feel more energized': '/images/onboarding/female/feel-more-energized.webp',
  'Reduce stress': '/images/onboarding/female/reduce-stress.webp',
  'Improve focus': '/images/onboarding/female/improve-focus.webp',
  'Break bad habits': '/images/onboarding/female/break-bad-habits.webp',
  'Get more organized': '/images/onboarding/female/get-more-organized.webp',
};

// Rule 3: pick the category art for the user's gender. Women get the female
// variant IFF gender === 'Female' AND a variant asset exists for that category;
// every other/undisclosed value falls back to the default art.
export function categoryArtForGender(
  category: FlowCategory,
  gender: string | null | undefined,
): string {
  if (gender === 'Female') {
    return FEMALE_CATEGORY_ART[category.label] ?? category.image;
  }
  return category.image;
}

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const REFERRAL_OPTIONS = ['Founder Invite', 'Webinar', 'Friend', 'Other'];

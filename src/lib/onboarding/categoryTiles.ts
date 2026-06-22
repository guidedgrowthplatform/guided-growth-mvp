// Shared category-tile data for Step3 (onboarding) and add-habit's beginner phase.
export const categories = [
  { label: 'Sleep better', slug: 'sleep-better' },
  { label: 'Move more', slug: 'move-more' },
  { label: 'Eat better', slug: 'eat-better' },
  { label: 'Feel more energized', slug: 'feel-more-energized' },
  { label: 'Reduce stress', slug: 'reduce-stress' },
  { label: 'Improve focus', slug: 'improve-focus' },
  { label: 'Break bad habits', slug: 'break-bad-habits' },
  { label: 'Get more organized', slug: 'get-more-organized' },
] as const;

export type Category = (typeof categories)[number];

export const CATEGORY_LABELS = categories.map((c) => c.label);

const maleSrc = (c: Category) => `/images/onboarding/male/${c.slug}.webp`;
const femaleSrc = (c: Category) => `/images/onboarding/female/${c.slug}.webp`;

// Other/unknown -> mixed: alternate by tile index.
export function categoryImage(c: Category, index: number, gender?: string | null) {
  if (gender === 'Male') return maleSrc(c);
  if (gender === 'Female') return femaleSrc(c);
  return index % 2 === 0 ? femaleSrc(c) : maleSrc(c);
}

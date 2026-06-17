// Shared category-tile data for Step3 (onboarding) and add-habit's beginner phase.
// female set is all .png; male carries maleExt (move-more/improve-focus are .jpg).
export const categories = [
  { label: 'Sleep better', slug: 'sleep-better', maleExt: 'png' },
  { label: 'Move more', slug: 'move-more', maleExt: 'jpg' },
  { label: 'Eat better', slug: 'eat-better', maleExt: 'png' },
  { label: 'Feel more energized', slug: 'feel-more-energized', maleExt: 'png' },
  { label: 'Reduce stress', slug: 'reduce-stress', maleExt: 'png' },
  { label: 'Improve focus', slug: 'improve-focus', maleExt: 'jpg' },
  { label: 'Break bad habits', slug: 'break-bad-habits', maleExt: 'png' },
  { label: 'Get more organized', slug: 'get-more-organized', maleExt: 'png' },
] as const;

export type Category = (typeof categories)[number];

export const CATEGORY_LABELS = categories.map((c) => c.label);

const maleSrc = (c: Category) => `/images/onboarding/male/${c.slug}.${c.maleExt}`;
const femaleSrc = (c: Category) => `/images/onboarding/female/${c.slug}.png`;

// Other/unknown -> mixed: alternate by tile index.
export function categoryImage(c: Category, index: number, gender?: string | null) {
  if (gender === 'Male') return maleSrc(c);
  if (gender === 'Female') return femaleSrc(c);
  return index % 2 === 0 ? femaleSrc(c) : maleSrc(c);
}

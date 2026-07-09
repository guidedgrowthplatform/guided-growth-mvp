import { describe, expect, it } from 'vitest';
import { categoryArtForGender, FLOW_CATEGORIES } from '../flowData';

// Rule 3: the women's category art is used ONLY when the user's gender answer is
// 'Female'. Men, non-binary ('Other') and undisclosed (null/undefined) all get
// the default art. Render-time asset swap on the SAME category screen.
describe('rule 3 — women-art category variant gated on gender == Female', () => {
  const sleep = FLOW_CATEGORIES.find((c) => c.label === 'Sleep better')!;

  it('picks the female variant when gender is Female', () => {
    const art = categoryArtForGender(sleep, 'Female');
    expect(art).toBe('/images/onboarding/female/sleep-better.webp');
    expect(art).not.toBe(sleep.image);
  });

  it('every category has a distinct female variant that differs from the default', () => {
    for (const c of FLOW_CATEGORIES) {
      const female = categoryArtForGender(c, 'Female');
      expect(female).toMatch(/^\/images\/onboarding\/female\/.+\.webp$/);
      expect(female).not.toBe(c.image);
    }
  });

  it.each(['Male', 'Other', null, undefined, ''])(
    'falls back to default art for gender=%p',
    (gender) => {
      expect(categoryArtForGender(sleep, gender as string | null | undefined)).toBe(sleep.image);
    },
  );

  it('default art is returned for every category when gender is not Female', () => {
    for (const c of FLOW_CATEGORIES) {
      expect(categoryArtForGender(c, 'Male')).toBe(c.image);
      expect(categoryArtForGender(c, undefined)).toBe(c.image);
    }
  });
});

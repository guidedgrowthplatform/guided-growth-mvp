export type ScreenKind = 'single' | 'multi';

export const MULTI_SCREENS = new Set<string>([
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-ADVANCED-02',
]);

export function screenKind(screenId: string): ScreenKind {
  return MULTI_SCREENS.has(screenId) ? 'multi' : 'single';
}

import { describe, expect, it } from 'vitest';
import type { ScreenRouteEntry } from '@/api/context';
import { screenIdForRoute } from './screenIdForRoute';

const ROUTES: ScreenRouteEntry[] = [
  { screen_id: 'WELCOME', route: '/welcome' },
  { screen_id: 'AUTH-SIGNUP', route: '/signup' },
  { screen_id: 'AUTH-LOGIN', route: '/login' },
  { screen_id: 'VOICE-PREFERENCE', route: '/onboarding/voice-preference' },
  { screen_id: 'MIC-PERMISSION', route: '/onboarding/mic-permission' },
  { screen_id: 'ONBOARD-01', route: '/onboarding/step-1' },
  { screen_id: 'HABIT-DETAIL', route: '/habit/:habitId' },
  { screen_id: 'EVENING-REFLECTION-ENTRY', route: '/reflections/:id' },
];

describe('screenIdForRoute', () => {
  it('returns the canonical screen_id for an exact static path match', () => {
    expect(screenIdForRoute(ROUTES, '/onboarding/step-1')).toBe('ONBOARD-01');
    expect(screenIdForRoute(ROUTES, '/welcome')).toBe('WELCOME');
  });

  it('matches dynamic-segment routes against the actual pathname', () => {
    expect(screenIdForRoute(ROUTES, '/habit/abc-123')).toBe('HABIT-DETAIL');
    expect(screenIdForRoute(ROUTES, '/reflections/5fa9')).toBe('EVENING-REFLECTION-ENTRY');
  });

  it('returns null when no route matches', () => {
    expect(screenIdForRoute(ROUTES, '/unmapped/path')).toBeNull();
    expect(screenIdForRoute(ROUTES, '/')).toBeNull();
  });

  it('does not match a dynamic pattern against a longer path', () => {
    expect(screenIdForRoute(ROUTES, '/habit/abc/extra')).toBeNull();
  });

  it('prefers exact static match over a dynamic match if both could fit', () => {
    const routes: ScreenRouteEntry[] = [
      { screen_id: 'HABIT-LIST', route: '/habit/list' },
      { screen_id: 'HABIT-DETAIL', route: '/habit/:habitId' },
    ];
    expect(screenIdForRoute(routes, '/habit/list')).toBe('HABIT-LIST');
  });
});

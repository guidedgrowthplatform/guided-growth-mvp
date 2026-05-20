import { describe, expect, it } from 'vitest';
import {
  BUNDLE_VERSION,
  getBundledContextBlock,
  getBundledRoutes,
  getBundledScreenIds,
} from './screenContextsBundle';

const ONBOARDING_SCREENS = [
  'SPLASH',
  'WELCOME',
  'AUTH-SIGNUP',
  'VOICE-PREFERENCE',
  'MIC-PERMISSION',
  'ONBOARD-01--FORM',
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-04',
  'ONBOARD-BEGINNER-05',
  'ONBOARD-BEGINNER-06',
  'ONBOARD-BEGINNER-07',
  'ONBOARD-BEGINNER-08',
  'ONBOARD-BEGINNER-09',
  'ONBOARD-ADVANCED',
  'ONBOARD-ADVANCED-02',
  'ONBOARD-ADVANCED-03',
  'ONBOARD-ADVANCED-04',
  'ONBOARD-ADVANCED-05',
  'HOME-RETURN',
];

describe('screenContextsBundle', () => {
  it('contains all 22 Phase 1 onboarding screens', () => {
    const ids = new Set(getBundledScreenIds());
    for (const id of ONBOARDING_SCREENS) {
      expect(ids.has(id), `missing screen_id: ${id}`).toBe(true);
    }
  });

  it('returns a context_block with the seeder header format', () => {
    const block = getBundledContextBlock('SPLASH');
    expect(block).not.toBeNull();
    expect(block!.context_block.startsWith('SCREEN_ID: SPLASH')).toBe(true);
    expect(block!.context_block).toContain('SCREEN_NAME:');
    expect(block!.context_block).toContain('ROUTE:');
  });

  it('returns null for unknown screen_id (triggers fallback)', () => {
    expect(getBundledContextBlock('NOT-A-REAL-SCREEN')).toBeNull();
  });

  it('exposes routes with router-canonical paths after ROUTE_OVERRIDES', () => {
    const routes = getBundledRoutes();
    const map = Object.fromEntries(routes.map((r) => [r.screen_id, r.route]));
    expect(map.SPLASH).toBe('/splash');
    expect(map['AUTH-SIGNUP']).toBe('/signup');
    expect(map['VOICE-PREFERENCE']).toBe('/onboarding/voice-preference');
    expect(map['MIC-PERMISSION']).toBe('/onboarding/mic-permission');
    expect(map['ONBOARD-01--FORM']).toBe('/onboarding/step-1');
    expect(map['HOME-RETURN']).toBe('/');
  });

  it('routes contain no duplicate route values (no collisions)', () => {
    const routes = getBundledRoutes();
    const paths = routes.map((r) => r.route);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('routes contain no null/empty entries', () => {
    const routes = getBundledRoutes();
    for (const r of routes) {
      expect(r.route).toBeTruthy();
      expect(r.screen_id).toBeTruthy();
    }
  });

  it('every routes entry corresponds to a screen in screens map', () => {
    const ids = new Set(getBundledScreenIds());
    for (const r of getBundledRoutes()) {
      expect(ids.has(r.screen_id), `route ${r.route} → ${r.screen_id} has no screen entry`).toBe(
        true,
      );
    }
  });

  it('returns a numeric version derived from the YYYY-MM-DD stamp', () => {
    const block = getBundledContextBlock('SPLASH');
    expect(typeof block!.version).toBe('number');
    expect(Number.isFinite(block!.version)).toBe(true);
    expect(BUNDLE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

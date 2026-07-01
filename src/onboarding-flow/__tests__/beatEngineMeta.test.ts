/**
 * Guards the metadata-driven engine classification during the transition period.
 *
 * The runtime now decides Vapi / idle per beat from node.meta.fill.brain (via
 * beatEngineMeta), with the legacy CHAT_VAPI_BEAT_SCREENS / LOCAL_CAPTURE_BEATS
 * sets kept only as a fallback for screens the flow meta does not cover. While
 * both live, they MUST agree for every screen, or behavior has silently changed.
 *
 * When the legacy sets are finally deleted (Mint's Phase 5 cleanup), rewrite the
 * two parity blocks to assert the expected meta values directly.
 */
import { describe, expect, it } from 'vitest';
import { CHAT_VAPI_BEAT_SCREENS, LOCAL_CAPTURE_BEATS } from '@/lib/onboarding/onboardingStepBeats';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import { isIdleCaptureBeat, isVapiCapableBeat } from '../beatEngineMeta';

const flowScreenIds = (flowJson.nodes as Array<{ screenId?: string }>)
  .map((n) => n.screenId)
  .filter((s): s is string => typeof s === 'string');

// Every screen the runtime could classify: the flow's own beats plus any id that
// still lives only in a legacy set (e.g. ONBOARD-BEGINNER-06 in one order model).
const universe = Array.from(new Set([...flowScreenIds, ...CHAT_VAPI_BEAT_SCREENS, ...LOCAL_CAPTURE_BEATS]));

describe('beatEngineMeta (metadata-driven engine per beat)', () => {
  it('every flow node carries a meta block (the export is not dropping it)', () => {
    const missing = (flowJson.nodes as Array<{ screenId?: string; meta?: unknown }>)
      .filter((n) => !n.meta)
      .map((n) => n.screenId);
    expect(missing).toEqual([]);
  });

  it('Vapi classification matches the legacy set for every screen', () => {
    const mismatches = universe.filter(
      (sid) => isVapiCapableBeat(sid) !== CHAT_VAPI_BEAT_SCREENS.has(sid),
    );
    expect(mismatches).toEqual([]);
  });

  it('idle-capture classification matches the legacy set for every screen', () => {
    const mismatches = universe.filter(
      (sid) => isIdleCaptureBeat(sid) !== LOCAL_CAPTURE_BEATS.has(sid),
    );
    expect(mismatches).toEqual([]);
  });

  it('returns false for an unknown screen id (no crash, no accidental Vapi)', () => {
    expect(isVapiCapableBeat('NOT-A-REAL-SCREEN')).toBe(false);
    expect(isIdleCaptureBeat(null)).toBe(false);
    expect(isVapiCapableBeat(undefined)).toBe(false);
  });
});

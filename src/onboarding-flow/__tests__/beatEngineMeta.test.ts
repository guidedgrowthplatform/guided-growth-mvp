/**
 * Guards the metadata-driven engine classification.
 *
 * The runtime decides Vapi / idle per beat from node.meta.fill.brain (via
 * beatEngineMeta). This asserts the accessor reflects the flow's AUTHORED
 * metadata for every screen, and pins the current export's shape (no Vapi beat;
 * the say-only / tap beats are idle). These are tied to the metadata, not to the
 * legacy CHAT_VAPI_BEAT_SCREENS set: when the metadata changes, they update with
 * flow:sync. If a future export sets voiceEngine: Vapi on a beat, update the
 * "no Vapi beat" pin accordingly.
 */
import { describe, expect, it } from 'vitest';
import { getBeatMeta, isIdleCaptureBeat, isVapiCapableBeat } from '../beatEngineMeta';
import flowJson from '../flows/onboarding-v1.generated.json';

type MetaNode = { screenId?: string; meta?: { fill?: { brain?: string } } };
const nodes = flowJson.nodes as MetaNode[];

describe('beatEngineMeta (metadata-driven engine per beat)', () => {
  it('every flow node carries a meta block (the export is not dropping it)', () => {
    const missing = (flowJson.nodes as Array<{ screenId?: string; meta?: unknown }>)
      .filter((n) => !n.meta)
      .map((n) => n.screenId);
    expect(missing).toEqual([]);
  });

  it('Vapi classification reads from the flow metadata for every screen', () => {
    const mismatches = nodes
      .filter(
        (n) => !!n.screenId && isVapiCapableBeat(n.screenId) !== (n.meta?.fill?.brain === 'vapi'),
      )
      .map((n) => n.screenId);
    expect(mismatches).toEqual([]);
  });

  it('the current onboarding export has no Vapi beat (MP3-dominant)', () => {
    const vapi = nodes
      .filter((n) => !!n.screenId && isVapiCapableBeat(n.screenId))
      .map((n) => n.screenId);
    expect(vapi).toEqual([]);
  });

  it('idle-capture classification reads from the flow metadata for every screen', () => {
    const mismatches = nodes
      .filter(
        (n) => !!n.screenId && isIdleCaptureBeat(n.screenId) !== (n.meta?.fill?.brain === 'none'),
      )
      .map((n) => n.screenId);
    expect(mismatches).toEqual([]);
  });

  it('returns false / undefined for an unknown screen id (no crash, no accidental Vapi)', () => {
    expect(isVapiCapableBeat('NOT-A-REAL-SCREEN')).toBe(false);
    expect(isIdleCaptureBeat(null)).toBe(false);
    expect(isVapiCapableBeat(undefined)).toBe(false);
    expect(getBeatMeta('NOT-A-REAL-SCREEN')).toBeUndefined();
  });
});

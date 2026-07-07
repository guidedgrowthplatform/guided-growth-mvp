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
import {
  beatOwnsOpenerAudio,
  getBeatMeta,
  isIdleCaptureBeat,
  isVapiCapableBeat,
} from '../beatEngineMeta';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';

type MetaNode = {
  screenId?: string;
  meta?: { fill?: { brain?: string }; voiceOut?: { engine?: string } };
  narration?: unknown[];
  componentOwned?: boolean;
};
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

describe('beatOwnsOpenerAudio (B58/B40: single-arm invariant)', () => {
  it('is true for every beat with a narration script (the narration driver owns it)', () => {
    const narrated = nodes.filter((n) => (n.narration?.length ?? 0) > 0);
    expect(narrated.length).toBeGreaterThan(0); // the export still carries narration beats
    for (const n of narrated) {
      expect(beatOwnsOpenerAudio(n.screenId)).toBe(true);
    }
  });

  it('is true for every non-componentOwned beat with an mp3 or cartesia voiceOut engine', () => {
    // componentOwned beats (COACH-GREETING, MIC-PERMISSION) own their ENTIRE
    // sequence outside both BeatView's opener hooks and the narration driver
    // (A4) — and never reach Direct-LLM anyway (their screenId isn't
    // onboarding-prefixed), so they're excluded here on purpose, not a gap.
    const audible = nodes.filter(
      (n) =>
        !n.componentOwned &&
        (n.meta?.voiceOut?.engine === 'mp3' || n.meta?.voiceOut?.engine === 'cartesia'),
    );
    expect(audible.length).toBeGreaterThan(0);
    for (const n of audible) {
      expect(beatOwnsOpenerAudio(n.screenId)).toBe(true);
    }
  });

  it('is false for componentOwned beats even with an mp3 voiceOut engine (they own their whole sequence, A4)', () => {
    const ownedAudible = nodes.filter(
      (n) =>
        n.componentOwned &&
        (n.meta?.voiceOut?.engine === 'mp3' || n.meta?.voiceOut?.engine === 'cartesia'),
    );
    expect(ownedAudible.length).toBeGreaterThan(0);
    for (const n of ownedAudible) {
      expect(beatOwnsOpenerAudio(n.screenId)).toBe(false);
    }
  });

  it('is false for beats with voiceOut engine "none" and no narration (nothing to collide with)', () => {
    const silent = nodes.filter(
      (n) => n.meta?.voiceOut?.engine === 'none' && (n.narration?.length ?? 0) === 0,
    );
    expect(silent.length).toBeGreaterThan(0);
    for (const n of silent) {
      expect(beatOwnsOpenerAudio(n.screenId)).toBe(false);
    }
  });

  it('this export has real narration beats whose fill.brain is direct-llm — exactly the double-arm shape B58 hardens against', () => {
    // Pins the regression scenario: a beat that BOTH plays its own scripted
    // audio (narration) AND is assigned to Direct-LLM by the engine selector.
    // Without beatOwnsOpenerAudio wired into useOnboardingChat, this exact
    // combination is what let Direct-LLM fire a redundant sendOpener() over
    // the narration driver's real clip.
    const narratedDirectLlm = nodes.filter(
      (n) => (n.narration?.length ?? 0) > 0 && n.meta?.fill?.brain === 'direct-llm',
    );
    expect(narratedDirectLlm.length).toBeGreaterThan(0);
    for (const n of narratedDirectLlm) {
      expect(beatOwnsOpenerAudio(n.screenId)).toBe(true);
    }
  });

  it('returns false for an unknown or missing screen id (no crash)', () => {
    expect(beatOwnsOpenerAudio('NOT-A-REAL-SCREEN')).toBe(false);
    expect(beatOwnsOpenerAudio(null)).toBe(false);
    expect(beatOwnsOpenerAudio(undefined)).toBe(false);
  });
});

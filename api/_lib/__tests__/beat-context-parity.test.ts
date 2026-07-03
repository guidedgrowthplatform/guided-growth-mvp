import { describe, expect, it } from 'vitest';

import onboardingCombined from '../../../src/generated/onboarding_combined.json' with { type: 'json' };
import {
  BEAT_CONTEXTS,
  GLOBAL_ONBOARDING_CONTEXT,
  getBeatContext,
} from '../llm/onboarding/beatContexts.js';
import { isOnboardingToolName } from '../llm/onboarding/schemas.js';

interface CombinedBeat {
  screenId: string;
  meta?: { fill?: { brain?: string; allowedTools?: string[] } } | null;
}

const beats = (onboardingCombined as { beats?: CombinedBeat[] }).beats ?? [];

// Beats whose data tool saves AND advances (addendum SELF-ADVANCING BEATS).
const SELF_ADVANCING = new Set([
  'record_checkin',
  'submit_morning_checkin',
  'submit_reflection_config',
]);
const OPTION_BEARING = [
  'ONBOARD-FORK--FORM',
  'ONBOARD-BEGINNER-01',
  'ONBOARD-BEGINNER-02',
  'ONBOARD-BEGINNER-03',
  'ONBOARD-BEGINNER-07',
];

describe('beat allowedTools parity (flow overlay vs tool registry)', () => {
  it('flow export has beats', () => {
    expect(beats.length).toBeGreaterThan(0);
  });

  // The overlay in beatContexts.ts silently filters unknown names; this is the
  // loud alarm a builder export naming a removed/renamed tool would otherwise miss.
  it('every overlay tool name is a real onboarding tool', () => {
    const unknown = beats.flatMap((b) =>
      (b.meta?.fill?.allowedTools ?? [])
        .filter((t) => !isOnboardingToolName(t))
        .map((t) => `${b.screenId}: ${t}`),
    );
    expect(unknown).toEqual([]);
  });

  it('every LLM-active beat has a beat context', () => {
    const missing = beats
      .filter((b) => b.meta?.fill?.brain === 'direct-llm')
      .filter((b) => getBeatContext(b.screenId) === undefined)
      .map((b) => b.screenId);
    expect(missing).toEqual([]);
  });

  it('every LLM-active beat keeps a progression tool after the overlay', () => {
    const stuck = beats
      .filter((b) => b.meta?.fill?.brain === 'direct-llm')
      .filter((b) => {
        const tools = getBeatContext(b.screenId)?.allowedTools ?? [];
        return !tools.some(
          (t) => t === 'advance_step' || t === 'confirm_plan' || SELF_ADVANCING.has(t),
        );
      })
      .map((b) => b.screenId);
    expect(stuck).toEqual([]);
  });
});

describe('anti-improvisation invariants (effective contexts)', () => {
  it('global context carries the Component sync rule', () => {
    expect(GLOBAL_ONBOARDING_CONTEXT).toContain('## Component sync');
    expect(GLOBAL_ONBOARDING_CONTEXT).toContain('## Speak mode');
  });

  it.each(OPTION_BEARING)('%s has SPEAK MODE and a DO NOT block', (screenId) => {
    const ctx = getBeatContext(screenId)?.context ?? '';
    expect(ctx).toContain('SPEAK MODE:');
    expect(ctx).toContain('DO NOT:');
  });

  it('option-bearing beats mark options as silent or scripted', () => {
    for (const screenId of ['ONBOARD-BEGINNER-01', 'ONBOARD-BEGINNER-02', 'ONBOARD-BEGINNER-03']) {
      expect(BEAT_CONTEXTS[screenId].context).toContain('SILENT_OPTIONS');
    }
  });

  // Spoken openers are deliverables: no em dashes, no gesture instructions.
  it('openers carry no em dashes and no gesture words', () => {
    const offenders = Object.entries(BEAT_CONTEXTS)
      .filter(([, b]) => b.opener !== undefined)
      .filter(([, b]) => /—|\b(tap|click|scroll|swipe|press)\b/i.test(b.opener ?? ''))
      .map(([id]) => id);
    expect(offenders).toEqual([]);
  });
});

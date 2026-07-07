/**
 * B48: locked openers (onboardingOpeners.ts) win over the flow document's
 * authored/seeded opener AND over the designerToFlow fallback, name-variant
 * aware; beats without a locked line keep the document opener; the rendered
 * line never contains a literal {name} token once applyName runs.
 *
 * Per Yair's 2026-07-07 ruling, the profile beat is the only beat that still
 * keeps a locked line here; every other beat (including reflection-setup,
 * ONBOARD-BEGINNER-07) now falls through to the flow document's seed/render
 * copy per resolveOnboardingOpener's fallback path.
 */
import { describe, expect, it } from 'vitest';
import { getNode } from '../flowMachine';
import { loadPublishedFlow } from '../useFlow';
import { applyName } from './applyName';
import { resolveBeatOpenerText, resolveOnboardingOpener } from './resolveBeatOpener';

const flow = loadPublishedFlow();
const node = (id: string) => {
  const n = getNode(flow, id);
  if (!n) throw new Error(`missing node ${id}`);
  return n;
};

describe('resolveBeatOpenerText (B48)', () => {
  it('profile with a known name renders the locked known-name line, not the seed/fallback', () => {
    const raw = resolveBeatOpenerText(node('profile'), 'Fable');
    expect(raw).toBe('Good to meet you, {name}. Two quick things so I can tailor this to you.');
    const rendered = applyName(raw!, 'Fable');
    expect(rendered).toContain('Good to meet you, Fable.');
    expect(rendered).not.toContain('{name}');
    // The stale "how old are you, and how do you identify?" locked line is gone
    // (synced to the render's profile opener per the reconcile).
    expect(rendered).not.toContain('how do you identify');
  });

  it('profile without a name renders the locked ask-name variant', () => {
    const raw = resolveBeatOpenerText(node('profile'), null);
    expect(raw).toContain('What should I call you?');
    expect(applyName(raw!, null)).not.toContain('{name}');
  });

  it('a beat without a locked line falls back to the flow document opener', () => {
    const stateCheck = node('state-check');
    expect(resolveBeatOpenerText(stateCheck, 'Fable')).toBe(stateCheck.voice.openerText);
  });

  it('reflection setup (ONBOARD-BEGINNER-07) has no locked line, renders the seed/render copy', () => {
    const reflectionSetup = node('reflection-setup');
    const raw = resolveBeatOpenerText(reflectionSetup, 'Fable');
    expect(raw).toMatch(/evening reflection/i);
    // No locked registry line for this beat anymore: the document opener wins.
    expect(raw).toBe(reflectionSetup.voice.openerText);
  });
});

describe('resolveOnboardingOpener (screenId-only callers, B48 fallback parity)', () => {
  it('matches resolveBeatOpenerText for a screenId with a locked line (profile)', () => {
    const profileNode = node('profile');
    expect(resolveOnboardingOpener('ONBOARD-01--FORM', 'Fable')).toBe(
      resolveBeatOpenerText(profileNode, 'Fable'),
    );
  });

  it('falls through to the flow document opener for a screenId with no locked line, never an empty string', () => {
    const reflectionSetup = node('reflection-setup');
    const resolved = resolveOnboardingOpener('ONBOARD-BEGINNER-07', 'Fable');
    expect(resolved).toBe(reflectionSetup.voice.openerText);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('returns an empty string, never throws, for an unknown screenId', () => {
    expect(resolveOnboardingOpener('ONBOARD-NOPE', 'Fable')).toBe('');
  });
});

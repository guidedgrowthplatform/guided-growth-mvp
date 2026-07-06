/**
 * B48: locked openers (onboardingOpeners.ts) win over the flow document's
 * authored/seeded opener AND over the designerToFlow fallback, name-variant
 * aware; beats without a locked line keep the document opener; the rendered
 * line never contains a literal {name} token once applyName runs.
 */
import { describe, expect, it } from 'vitest';
import { getNode } from '../flowMachine';
import { loadPublishedFlow } from '../useFlow';
import { applyName } from './applyName';
import { resolveBeatOpenerText } from './resolveBeatOpener';

const flow = loadPublishedFlow();
const node = (id: string) => {
  const n = getNode(flow, id);
  if (!n) throw new Error(`missing node ${id}`);
  return n;
};

describe('resolveBeatOpenerText (B48)', () => {
  it('profile with a known name renders the locked known-name line, not the seed/fallback', () => {
    const raw = resolveBeatOpenerText(node('profile'), 'Fable');
    expect(raw).toBe(
      'Awesome {name}, two quick things so I can tailor this to you. How old are you, and how do you identify?',
    );
    const rendered = applyName(raw!, 'Fable');
    expect(rendered).toContain('Awesome Fable,');
    expect(rendered).not.toContain('{name}');
    expect(rendered).not.toContain('Good to meet you');
  });

  it('profile without a name renders the locked ask-name variant', () => {
    const raw = resolveBeatOpenerText(node('profile'), null);
    expect(raw).toContain('What should I call you?');
    expect(applyName(raw!, null)).not.toContain('{name}');
  });

  it('a non-profile beat with a locked line renders it (reflection setup)', () => {
    const raw = resolveBeatOpenerText(node('reflection-setup'), 'Fable');
    expect(raw).toMatch(/evening reflection/i);
    // The locked registry line, not the flow document's seeded opener.
    expect(raw).not.toBe(node('reflection-setup').voice.openerText);
  });

  it('a beat without a locked line falls back to the flow document opener', () => {
    const stateCheck = node('state-check');
    expect(resolveBeatOpenerText(stateCheck, 'Fable')).toBe(stateCheck.voice.openerText);
  });
});

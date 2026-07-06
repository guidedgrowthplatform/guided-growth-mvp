/** @vitest-environment jsdom */
/**
 * A4: a componentOwned beat renders its adapter ALONE. No coach bubble, no
 * driver audio chrome; the component owns the whole sequence and the engine
 * waits on its capture (the completion signal). hideOrb is the sibling rule,
 * exercised in FlowRenderer (docked orb suppressed while such a beat is
 * active) and locked here at the BeatView level.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BeatNode } from '../../types';
import { BeatView } from '../BeatView';

const NODE = {
  id: 'demo-owned',
  type: 'beat',
  screenId: 'ONBOARD-BEGINNER-02-CUSTOM',
  componentType: 'custom-entry',
  componentProps: { kind: 'goal', title: 'Your goal' },
  voice: {
    openerText: 'This opener must NOT render: the component owns the beat.',
    expectsInput: true,
    directLlmAllowed: true,
  },
  meta: {
    voiceOut: {
      engine: 'mp3',
      mode: 'verbatim',
      mp3Assets: [{ label: 'x', file: '/voice/x.mp3', transcript: 'x' }],
    },
    voiceIn: { engine: 'none', enabled: false },
    fill: { brain: 'none', llmActive: false, allowedTools: [] },
    path: 'path-3-direct-llm',
    orb: {},
    toggles: { expectsInput: true, directLlmAllowed: true },
  },
  tool: null,
  persist: null,
  componentOwned: true,
} as unknown as BeatNode;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('BeatView componentOwned (A4)', () => {
  it('renders the adapter alone: no opener bubble, the card is interactive', () => {
    act(() => {
      root.render(<BeatView node={NODE} answers={{}} active onCapture={() => {}} />);
    });
    // The adapter's card renders...
    expect(container.querySelector('input')).toBeTruthy();
    expect(container.textContent).toContain('Your goal');
    // ...and the authored opener never draws (the component owns the beat).
    expect(container.textContent).not.toContain('must NOT render');
  });
});

/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  OnboardingVoiceContext,
  type OnboardingVoiceContextValue,
  type VoiceMessage,
} from '@/contexts/useOnboardingVoiceSession';
import { BeatConversation } from '../BeatPlayer';

const OPENER = 'Welcome to your plan';
const REPLY = 'Great, saving that now';

function makeValue(messages: VoiceMessage[]): OnboardingVoiceContextValue {
  return {
    messages,
    subscribeTranscripts: () => () => {},
    openerReveal: null,
  } as unknown as OnboardingVoiceContextValue;
}

const thread: VoiceMessage[] = [
  { id: 'op1', role: 'ai', text: OPENER, screenId: 'S1', source: 'opener' },
  { id: 'u1', role: 'user', text: 'sounds good', screenId: 'S1', source: 'direct_llm' },
  { id: 'a1', role: 'ai', text: REPLY, screenId: 'S1', source: 'direct_llm' },
];

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

function render(
  value: OnboardingVoiceContextValue,
  opts: { hideOpener?: boolean; active?: boolean } = {},
) {
  act(() => {
    root.render(
      <OnboardingVoiceContext.Provider value={value}>
        <BeatConversation
          screenId="S1"
          active={opts.active ?? true}
          connecting={false}
          hideOpener={opts.hideOpener ?? false}
        />
      </OnboardingVoiceContext.Provider>,
    );
  });
}

const leafTexts = () =>
  Array.from(container.querySelectorAll('div'))
    .filter((d) => d.children.length === 0)
    .map((d) => d.textContent);

describe('BeatConversation hideOpener (B33 — voice mode drew the opener twice)', () => {
  it('suppresses the committed store opener but keeps the dialogue turns', () => {
    render(makeValue(thread), { hideOpener: true });
    expect(container.textContent).not.toContain(OPENER);
    expect(container.textContent).toContain('sounds good');
    expect(container.textContent).toContain(REPLY);
  });

  it('still renders the opener when the flag is off (non-BeatPlayer callers unchanged)', () => {
    render(makeValue(thread), { hideOpener: false });
    expect(container.textContent).toContain(OPENER);
    expect(container.textContent).toContain(REPLY);
  });
});

describe('BeatConversation past-beat opener turn split (B34 — merged profile bubble)', () => {
  const AGE = 'How old are you?';
  const GENDER = 'And how do you identify?';
  const multiTurn: VoiceMessage[] = [
    { id: 'op2', role: 'ai', text: `${AGE}\n${GENDER}`, screenId: 'S1' },
    { id: 'u2', role: 'user', text: '30, male', screenId: 'S1', source: 'direct_llm' },
  ];

  it('replays a committed multi-line opener as one bubble per line', () => {
    render(makeValue(multiTurn), { active: false });
    const leaves = leafTexts();
    expect(leaves).toContain(AGE);
    expect(leaves).toContain(GENDER);
    expect(leaves).not.toContain(`${AGE}\n${GENDER}`);
  });

  it('keeps a single-line committed opener as a single bubble', () => {
    render(makeValue(thread), { active: false });
    expect(leafTexts()).toContain(OPENER);
  });
});

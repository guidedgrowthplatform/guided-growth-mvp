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

function render(value: OnboardingVoiceContextValue, hideOpener: boolean) {
  act(() => {
    root.render(
      <OnboardingVoiceContext.Provider value={value}>
        <BeatConversation screenId="S1" active connecting={false} hideOpener={hideOpener} />
      </OnboardingVoiceContext.Provider>,
    );
  });
}

describe('BeatConversation hideOpener (B33 — voice mode drew the opener twice)', () => {
  it('suppresses the committed store opener but keeps the dialogue turns', () => {
    render(makeValue(thread), true);
    expect(container.textContent).not.toContain(OPENER);
    expect(container.textContent).toContain('sounds good');
    expect(container.textContent).toContain(REPLY);
  });

  it('still renders the opener when the flag is off (non-BeatPlayer callers unchanged)', () => {
    render(makeValue(thread), false);
    expect(container.textContent).toContain(OPENER);
    expect(container.textContent).toContain(REPLY);
  });
});

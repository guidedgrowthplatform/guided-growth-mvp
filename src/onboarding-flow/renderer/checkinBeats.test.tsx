/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { useTtsPlaybackStore } from '@/lib/services/tts-service';
import type { FlowNode } from '../types';
import { BeatView } from './BeatView';
import { summarizeBeat } from './componentRegistry';
import { useCoachSpeechReveal, type CoachSpeechReveal } from './useCoachSpeechReveal';

vi.mock('@/contexts/useOnboardingVoiceSession', () => ({
  useOnboardingVoice: () => null,
  useOnboardingVoiceActions: () => {},
}));

vi.mock('@/lib/services/tts-service', async () => {
  const { create } = await import('zustand');
  return {
    useTtsPlaybackStore: create<{ isSpeaking: boolean }>(() => ({ isSpeaking: false })),
    beginSpeechTurn: vi.fn(),
    pushSpeechChunk: vi.fn(),
    endSpeechTurn: vi.fn(() => Promise.resolve()),
    stopTTS: vi.fn(),
  };
});

const stateCheckNode = {
  id: 'morning-state',
  type: 'beat',
  componentType: 'state-check',
  voice: { openerText: 'How are you?' },
  componentProps: { dimensions: ['sleep', 'mood', 'energy', 'stress'] },
} as unknown as FlowNode;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => useTtsPlaybackStore.setState({ isSpeaking: false }));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('summarizeBeat state-check', () => {
  it('lists the chosen per-dimension label', () => {
    const summary = summarizeBeat(stateCheckNode, { checkin: { sleep: 4 } });
    expect(summary).toContain(checkInDimensions[0].label);
  });

  it('returns null with no captured scales', () => {
    expect(summarizeBeat(stateCheckNode, {})).toBeNull();
  });
});

describe('useCoachSpeechReveal window mode', () => {
  function render(active: boolean, onResult: (r: CoachSpeechReveal) => void) {
    function Probe() {
      onResult(useCoachSpeechReveal('one two three', active));
      return null;
    }
    act(() => root.render(createElement(Probe)));
  }

  it('is fallback with no speech signal, window once TTS speaks, snaps to full on end', () => {
    let last!: CoachSpeechReveal;
    const onResult = (r: CoachSpeechReveal) => (last = r);

    render(true, onResult);
    expect(last.mode).toBe('fallback');

    act(() => useTtsPlaybackStore.setState({ isSpeaking: true }));
    expect(last.mode).toBe('window');

    act(() => useTtsPlaybackStore.setState({ isSpeaking: false }));
    expect(last.mode).toBe('window');
    expect(last.revealCount).toBe(3);
  });
});

describe('active-beat tap bubble', () => {
  function click(el: Element) {
    act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  }

  it('echoes the tapped state-check answer as a user bubble', () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        createElement(BeatView, {
          node: stateCheckNode,
          answers: {},
          active: true,
          onCapture: vi.fn(),
        }),
      );
    });
    // Reveal the card beneath the coach line (fallback dwell).
    act(() => vi.advanceTimersByTime(1500));

    const emoji = container.querySelector('button[aria-pressed]');
    expect(emoji).toBeTruthy();
    click(emoji!);

    const cta = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Continue',
    );
    expect(cta).toBeTruthy();
    click(cta!);

    expect(container.textContent).toContain(checkInDimensions[0].label);
  });
});

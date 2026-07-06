/** @vitest-environment jsdom */
/**
 * NarrationBeatView sequencing (Lane A A1). The audio hook is mocked with a
 * test-driven store so each segment's clip can be finished on demand; the view
 * must advance bubble -> bubble -> reveals in array order, bloom the card's
 * elements through NarrationRevealContext, and hand over to the dialogue
 * stream when the script ends.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeatNode, NarrationSegment } from '../../types';
import type { BeatOpenerMp3State } from '../useBeatOpenerMp3';
import { NarrationBeatView } from './NarrationBeatView';
import { useNarrationElementCount } from './NarrationRevealContext';

/* ------------------------------------------- controllable audio hook mock */

const clipDone = new Set<string>();
const listeners = new Set<() => void>();
function finishClip(src: string) {
  clipDone.add(src);
  listeners.forEach((l) => l());
}
function resetClips() {
  clipDone.clear();
}

vi.mock('../useBeatOpenerMp3', () => ({
  useBeatOpenerMp3: (src: string | null, active: boolean): BeatOpenerMp3State => {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
      const l = () => force();
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    }, []);
    const done = !!src && clipDone.has(src);
    return {
      playing: !!src && active && !done,
      done,
      progress: done ? 1 : src && active ? 0.4 : null,
      revealWords: null,
      blocked: false,
      textFallback: false,
      stop: () => {},
    };
  },
}));

/* --------------------------------------------------------------- fixtures */

const SEGMENTS: NarrationSegment[] = [
  { kind: 'bubble', n: 1, say: 'First framing line.', clip: '/voice/demo_b1.mp3' },
  { kind: 'bubble', n: 2, say: 'Second framing line.', clip: '/voice/demo_b2.mp3' },
  { kind: 'reveal', n: 1, say: "How's your sleep?" },
  { kind: 'reveal', n: 2, say: "How's your mood?" },
];

const NODE = {
  id: 'demo-state-check',
  type: 'beat',
  screenId: 'ONBOARD-STATE-CHECK',
  componentType: 'state-check',
  voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
  narration: SEGMENTS,
} as unknown as BeatNode;

// Probe card: reports how many of its 4 elements the context reveals.
function ProbeCard() {
  const count = useNarrationElementCount(4);
  return <div data-testid="probe">rows:{count}</div>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  resetClips();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const bubbles = () =>
  Array.from(container.querySelectorAll('div')).filter(
    (d) => d.className.includes('self-start') && d.className.includes('bg-white'),
  );
const probeText = () => container.querySelector('[data-testid="probe"]')?.textContent ?? null;

function mount() {
  act(() => {
    root.render(
      <NarrationBeatView node={NODE} answers={{}} card={<ProbeCard />} onCapture={() => {}} />,
    );
  });
}

describe('NarrationBeatView', () => {
  it('plays segments in order: bubble, bubble, then element reveals bloom the card', () => {
    mount();
    // Segment 0: one bubble, no card yet.
    expect(bubbles()).toHaveLength(1);
    expect(probeText()).toBeNull();

    // Finish bubble 1's clip + the breath: bubble 2 appears.
    act(() => finishClip('/voice/demo_b1.mp3'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(bubbles()).toHaveLength(2);
    expect(probeText()).toBeNull();

    // Finish bubble 2's clip: first reveal segment starts, card mounts at rows:1.
    act(() => finishClip('/voice/demo_b2.mp3'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(probeText()).toBe('rows:1');
    // Reveal says are verbal-only: still exactly two coach bubbles.
    expect(bubbles()).toHaveLength(2);

    // Reveal 1 has no clip: it advances on the text-cadence dwell.
    act(() => {
      vi.advanceTimersByTime(650 + 3 * 110 + 20);
    });
    expect(probeText()).toBe('rows:2');

    // Last reveal's dwell ends the script: everything shown (context null -> 4).
    act(() => {
      vi.advanceTimersByTime(650 + 3 * 110 + 20);
    });
    expect(probeText()).toBe('rows:4');
  });

  it('does not advance past a clip segment until its audio settles', () => {
    mount();
    expect(bubbles()).toHaveLength(1);
    // Time alone must not advance a clip-backed segment.
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(bubbles()).toHaveLength(1);
    expect(probeText()).toBeNull();
  });
});

/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBrainDump } from '@/api/parseHabits';
import {
  OnboardingVoiceContext,
  type OnboardingVoiceActionListener,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import type { ParsedHabit } from '@gg/shared/types';
import { getAdapter } from '../renderer/componentRegistry';
import type { FlowNode } from '../types';

// F10/F27 regression coverage: the coach completes ONBOARD-ADVANCED by firing
// submit_brain_dump, which the app translates into ONE `fill_field
// brainDumpText` voice action (see toolEventToVoiceActions.ts). That handler
// used to call submit() synchronously right after kicking off the async
// AI-tier parse, so the beat captured (and advanced past) whatever the
// instant regex tier alone produced. A plain multi-sentence dump with no
// commas/"and" ("Walking. Reading. Drinking more water.") under-splits on the
// regex tier alone, so this asserts the beat now waits for the AI parse
// (which correctly splits it into 3) before capturing.

vi.mock('@/api/parseHabits', () => ({ parseBrainDump: vi.fn() }));
const parseMock = vi.mocked(parseBrainDump);

const NODE = { id: 'advanced-input', screenId: 'ONBOARD-ADVANCED' } as unknown as FlowNode;

function makeBus() {
  const listeners = new Set<OnboardingVoiceActionListener>();
  const value = {
    subscribeVoiceActions: (l: OnboardingVoiceActionListener) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  } as unknown as OnboardingVoiceContextValue;
  const push = (r: OnboardingVoiceResult) => {
    act(() => {
      for (const l of listeners) l(r);
    });
  };
  return { value, push };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  parseMock.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const fillBrainDumpText = (value: string): OnboardingVoiceResult => ({
  success: true,
  action: 'fill_field',
  params: { fieldName: 'brainDumpText', value },
  message: '',
  confidence: 1,
});

describe('BrainDumpCapture — voice/tool fill_field waits for the AI parse before capturing (F10, F27)', () => {
  it('captures all 3 AI-split habits, not just the regex-tier collapse, on a period-only dump', async () => {
    let resolveAI!: (h: ParsedHabit[]) => void;
    parseMock.mockImplementation(() => new Promise((r) => (resolveAI = r)));

    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('advanced-capture')!;
    act(() => {
      root.render(
        <OnboardingVoiceContext.Provider value={bus.value}>
          <Adapter node={NODE} answers={{}} onCapture={onCapture} readOnly={false} />
        </OnboardingVoiceContext.Provider>,
      );
    });

    bus.push(fillBrainDumpText('Walking. Reading. Drinking more water.'));

    // Must NOT have captured yet — the AI parse is still in flight.
    expect(onCapture).not.toHaveBeenCalled();

    await act(async () => {
      resolveAI([
        { name: 'Walking', frequency: 'daily' },
        { name: 'Reading', frequency: 'daily' },
        { name: 'Drinking more water', frequency: 'daily' },
      ]);
    });

    expect(onCapture).toHaveBeenCalledTimes(1);
    const captured = onCapture.mock.calls[0][0].data.brainDumpHabits as { name: string }[];
    expect(captured.map((h) => h.name).sort()).toEqual([
      'Drinking more water',
      'Reading',
      'Walking',
    ]);
  });

  it('still captures via the regex tier alone if the AI parse errors (never wedges the beat)', async () => {
    let rejectAI!: (e: Error) => void;
    parseMock.mockImplementation(() => new Promise((_r, rej) => (rejectAI = rej)));

    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('advanced-capture')!;
    act(() => {
      root.render(
        <OnboardingVoiceContext.Provider value={bus.value}>
          <Adapter node={NODE} answers={{}} onCapture={onCapture} readOnly={false} />
        </OnboardingVoiceContext.Provider>,
      );
    });

    bus.push(fillBrainDumpText('go to the gym, meditate daily'));
    expect(onCapture).not.toHaveBeenCalled();

    await act(async () => {
      rejectAI(new Error('parse_failed'));
    });

    expect(onCapture).toHaveBeenCalledTimes(1);
    const captured = onCapture.mock.calls[0][0].data.brainDumpHabits as { name: string }[];
    expect(captured.map((h) => h.name).sort()).toEqual(['go to the gym', 'meditate']);
  });

  it('a past (readOnly) advanced-capture card never captures — the active beat owns advancement', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('advanced-capture')!;
    act(() => {
      root.render(
        <OnboardingVoiceContext.Provider value={bus.value}>
          <Adapter
            node={NODE}
            answers={{ brainDumpHabits: [{ name: 'Walking' }] }}
            onCapture={onCapture}
            readOnly
          />
        </OnboardingVoiceContext.Provider>,
      );
    });
    bus.push(fillBrainDumpText('Reading. Journaling.'));
    expect(onCapture).not.toHaveBeenCalled();
  });
});

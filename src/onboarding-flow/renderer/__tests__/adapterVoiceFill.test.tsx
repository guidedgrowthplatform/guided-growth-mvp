/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OnboardingVoiceContext,
  type OnboardingVoiceActionListener,
  type OnboardingVoiceContextValue,
  type OnboardingVoiceResult,
} from '@/contexts/useOnboardingVoiceSession';
import { getAdapter } from '../componentRegistry';

// Minimal controllable voice bus: the card subscribes, the test pushes actions.
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
  // jsdom has no scrollTo; AgeScrollPicker calls it on mount.
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Provider({
  value,
  children,
}: {
  value: OnboardingVoiceContextValue;
  children: ReactNode;
}) {
  return (
    <OnboardingVoiceContext.Provider value={value}>{children}</OnboardingVoiceContext.Provider>
  );
}

describe('ProfileAdapter — voice fill auto-submits onCapture', () => {
  it('fills age + gender from the bus and captures without a tap', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('profile-input')!;
    const props = {
      answers: { nickname: 'Mint' },
      onCapture,
      readOnly: false,
    } as unknown as Parameters<typeof Adapter>[0];

    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter {...props} />
        </Provider>,
      );
    });

    const r = (action: string, params: Record<string, unknown>): OnboardingVoiceResult =>
      ({ success: true, action, params, message: '', confidence: 1 }) as OnboardingVoiceResult;

    bus.push(r('fill_field', { fieldName: 'age', value: 30 }));
    bus.push(r('select_option', { fieldName: 'gender', value: 'Male' }));

    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture.mock.calls[0][0]).toMatchObject({
      data: { age: 30, gender: 'Male', nickname: 'Mint' },
    });
  });

  it('does not capture on a single voice field (multi-field beat)', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('profile-input')!;
    const props = {
      answers: { nickname: 'Mint' },
      onCapture,
      readOnly: false,
    } as unknown as Parameters<typeof Adapter>[0];

    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter {...props} />
        </Provider>,
      );
    });

    bus.push({
      success: true,
      action: 'fill_field',
      params: { fieldName: 'age', value: 30 },
      message: '',
      confidence: 1,
    } as OnboardingVoiceResult);

    expect(onCapture).not.toHaveBeenCalled();
  });
});

describe('AdvancedCaptureAdapter — live skimmer capture contract (S2, B26)', () => {
  const NODE = {
    id: 'advanced-input',
    componentType: 'advanced-capture',
    screenId: 'ONBOARD-ADVANCED',
    componentProps: {},
  };

  it('coach submit_brain_dump (fill_field brainDumpText) captures cards, not just raw text', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('advanced-capture')!;
    const props = {
      node: NODE,
      answers: {},
      onCapture,
      readOnly: false,
    } as unknown as Parameters<typeof Adapter>[0];

    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter {...props} />
        </Provider>,
      );
    });

    bus.push({
      success: true,
      action: 'fill_field',
      params: { fieldName: 'brainDumpText', value: 'go to the gym monday, quit smoking' },
      message: '',
      confidence: 1,
    } as OnboardingVoiceResult);

    expect(onCapture).toHaveBeenCalledTimes(1);
    const data = onCapture.mock.calls[0][0].data as {
      brainDumpText: string;
      brainDumpHabits: { name: string; days?: number[]; polarity?: string }[];
    };
    expect(data.brainDumpText).toBe('go to the gym monday, quit smoking');
    expect(data.brainDumpHabits).toEqual([
      { name: 'go to the gym', days: [1], polarity: 'positive' },
      { name: 'quit smoking', polarity: 'negative' },
    ]);

    // A second tool fire must not double-capture.
    bus.push({
      success: true,
      action: 'fill_field',
      params: { fieldName: 'brainDumpText', value: 'go to the gym monday, quit smoking' },
      message: '',
      confidence: 1,
    } as OnboardingVoiceResult);
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it('frozen receipt replays captured cards; falls back to the dump text without them', () => {
    const bus = makeBus();
    const Adapter = getAdapter('advanced-capture')!;
    const withCards = {
      node: NODE,
      answers: {
        brainDumpText: 'raw text',
        brainDumpHabits: [{ name: 'read before bed', days: [1, 3], polarity: 'positive' }],
      },
      onCapture: vi.fn(),
      readOnly: true,
    } as unknown as Parameters<typeof Adapter>[0];
    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter {...withCards} />
        </Provider>,
      );
    });
    expect(container.textContent).toContain('Read before bed');
    expect(container.querySelector('textarea')).toBeNull();

    const textOnly = {
      node: { ...NODE, componentProps: { brainDump: true } },
      answers: { brainDumpText: 'my old raw dump' },
      onCapture: vi.fn(),
      readOnly: true,
    } as unknown as Parameters<typeof Adapter>[0];
    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter {...textOnly} />
        </Provider>,
      );
    });
    expect((container.querySelector('textarea') as HTMLTextAreaElement)?.value).toBe(
      'my old raw dump',
    );
  });
});

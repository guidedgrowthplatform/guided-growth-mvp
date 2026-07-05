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
import { BeatView } from '../BeatView';
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

describe('BeatView finale — confirm_plan voice action advances like the tap (B32)', () => {
  // The listener lives on the BEAT (BeatView), not the card adapter: the card
  // mounts only after the opener reveals, and an early "let's go" was dropped.
  const intoAppNode = {
    id: 'into-app',
    type: 'beat',
    beatNumber: 9,
    name: 'Into the App',
    screenId: 'ONBOARD-COMPLETE',
    nextId: 'weekly-projection-blank',
    backId: null,
    context: { screenId: 'ONBOARD-COMPLETE', screenName: 'Into the App', contextBlock: '' },
    componentType: 'into-app',
    componentProps: {},
    voice: { openerText: "Here's your plan.", expectsInput: true, directLlmAllowed: true },
    tool: null,
    persist: null,
  } as unknown as import('../../types').FlowNode;

  const renderBeat = (onCapture: () => void, busValue: OnboardingVoiceContextValue, active = true) =>
    act(() => {
      root.render(
        <Provider value={busValue}>
          <BeatView
            node={intoAppNode}
            answers={{}}
            active={active}
            onCapture={onCapture}
          />
        </Provider>,
      );
    });

  const confirm = (success = true): OnboardingVoiceResult => ({
    success,
    action: 'confirm_plan',
    params: {},
    message: '',
    confidence: 1,
  });

  it('captures once on a successful confirm_plan, even BEFORE the card step reveals', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    renderBeat(onCapture, bus.value);
    // No timers advanced: the BeatPlayer card step has NOT revealed yet — the
    // beat-level listener must still catch the action (the old adapter-scoped
    // listener dropped exactly this case).
    bus.push(confirm());
    expect(onCapture).toHaveBeenCalledTimes(1);
    // one-shot: a duplicate event must not double-advance
    bus.push(confirm());
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it('ignores failed confirm_plan and unrelated actions', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    renderBeat(onCapture, bus.value);
    bus.push(confirm(false));
    bus.push({
      success: true,
      action: 'record_checkin',
      params: {},
      message: '',
      confidence: 1,
    } as OnboardingVoiceResult);
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('an inactive (past) into-app beat never captures — the active beat owns advancement', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    renderBeat(onCapture, bus.value, false);
    bus.push(confirm());
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('the tap CTA still fires capture, and readOnly hides it', () => {
    const bus = makeBus();
    const onCapture = vi.fn();
    const Adapter = getAdapter('into-app')!;
    const props = { node: { componentProps: {} }, answers: {}, onCapture, readOnly: false };
    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter {...(props as unknown as Parameters<typeof Adapter>[0])} />
        </Provider>,
      );
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    act(() => {
      btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCapture).toHaveBeenCalledTimes(1);
    act(() => {
      root.render(
        <Provider value={bus.value}>
          <Adapter
            {...({ ...props, readOnly: true } as unknown as Parameters<typeof Adapter>[0])}
          />
        </Provider>,
      );
    });
    expect(container.querySelector('button')).toBeNull();
  });
});

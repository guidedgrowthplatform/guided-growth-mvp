/** @vitest-environment jsdom */
/**
 * W3-B — a rejected submit_morning_checkin (the setup-config guard, B58/!478)
 * must leave no visual trace. The server guard returns ok:false and never
 * writes onboarding_states.data.morningCheckin, so answers.morningCheckin
 * stays undefined. MorningCheckinAdapter must not render a fully-configured
 * card once the beat is FROZEN (readOnly) with no real saved config — that
 * would look like the save succeeded when it didn't (server truth only).
 *
 * The still-ACTIVE case (readOnly=false/undefined) is unaffected: it's the
 * same live setup form the user can still fill in for real, and is already
 * covered by scheduleDayPickerResync.test.tsx.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BeatNode, FlowAnswers } from '../../types';
import { getAdapter } from '../componentRegistry';

function morningNode(): BeatNode {
  return {
    id: 'demo-morning-checkin-setup',
    type: 'beat',
    beatNumber: 1,
    name: 'morning-checkin-setup',
    screenId: 'ONBOARD-MORNING-SETUP',
    nextId: null,
    backId: null,
    context: { screenId: '', screenName: '', contextBlock: '' },
    componentType: 'morning-checkin-setup',
    componentProps: {},
    voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
    tool: null,
    persist: null,
  } as unknown as BeatNode;
}

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

describe('W3-B — frozen morning check-in card renders no trace after a refusal', () => {
  it('renders nothing when frozen (readOnly) with no saved morningCheckin', () => {
    const Adapter = getAdapter('morning-checkin-setup')!;
    const node = morningNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={() => {}} readOnly />);
    });

    expect(container.textContent).toBe('');
    expect(container.querySelector('button')).toBeNull();
  });

  it('still renders the frozen card when morningCheckin genuinely was saved', () => {
    const Adapter = getAdapter('morning-checkin-setup')!;
    const node = morningNode();
    const answers: FlowAnswers = {
      morningCheckin: { time: '08:00', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
    };

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} readOnly />);
    });

    expect(container.textContent).not.toBe('');
  });

  it('still renders the live editable form when the beat is active (not frozen), even with no config yet', () => {
    const Adapter = getAdapter('morning-checkin-setup')!;
    const node = morningNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={() => {}} />);
    });

    // Active (not readOnly) beats still show the live setup form regardless of
    // this fix — the user can genuinely fill it in. A Continue button proves
    // the interactive form rendered.
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('Continue'))).toBe(true);
  });
});

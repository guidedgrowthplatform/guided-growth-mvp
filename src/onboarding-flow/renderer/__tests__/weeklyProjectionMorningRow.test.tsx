/** @vitest-environment jsdom */
/**
 * W3-B — the weekly-projection beat's plan-summary grid (rendered at the end
 * of onboarding, in every projection frame: blank/full/p78/p36/gaps) must not
 * show a "Morning state check-in" row unless answers.morningCheckin genuinely
 * exists (server truth: submit_morning_checkin actually saved). A refused
 * morning check-in must leave no row here, while the other two rituals
 * (Evening habit report, Daily reflection) and real captured habits are
 * unaffected.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BeatNode, FlowAnswers } from '../../types';
import { getAdapter } from '../componentRegistry';

function projectionNode(): BeatNode {
  return {
    id: 'demo-weekly-projection',
    type: 'beat',
    beatNumber: 1,
    name: 'weekly-projection',
    screenId: 'ONBOARD-WEEKLY-PROJECTION-BLANK',
    nextId: null,
    backId: null,
    context: { screenId: '', screenName: '', contextBlock: '' },
    componentType: 'weekly-projection',
    componentProps: { state: 'blank' },
    voice: { openerText: null, expectsInput: false, directLlmAllowed: false },
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

describe('W3-B — weekly-projection grid omits the morning row after a refusal', () => {
  it('does not render "Morning state check-in" when morningCheckin was never saved', () => {
    const Adapter = getAdapter('weekly-projection')!;
    const node = projectionNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={() => {}} />);
    });

    expect(container.textContent).not.toContain('Morning state check-in');
    // The other two rituals still render.
    expect(container.textContent).toContain('Evening habit report');
    expect(container.textContent).toContain('Daily reflection');
  });

  it('renders "Morning state check-in" when it was genuinely configured', () => {
    const Adapter = getAdapter('weekly-projection')!;
    const node = projectionNode();
    const answers: FlowAnswers = {
      morningCheckin: { time: '08:00', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
    };

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    expect(container.textContent).toContain('Morning state check-in');
  });
});

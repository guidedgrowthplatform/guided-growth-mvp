/** @vitest-environment jsdom */
/**
 * B53 — the day-picker render bug. The backend correctly saves
 * days=[0,1,2,3,4,5,6] for an explicit "every day"/"every night" intent (see
 * the handler reconciliation tests in api/_lib/vapi/__tests__/handlers-reconcile.test.ts),
 * but the on-screen schedule card kept showing Mon-Fri only when the correct
 * `days` value arrived AFTER the card had already mounted with a stale/default
 * value: MorningCheckinAdapter's ScheduleCard and ReflectionAdapter both seed
 * `days`/`schedule` via a useState LAZY INITIALIZER, which only runs once on
 * mount and never re-derives from later prop/answers changes.
 *
 * These render the adapters directly (bypassing BeatView's presentation/audio
 * chrome, which is orthogonal to this bug), then re-render with updated
 * `answers` — the shape a real backend save produces — and assert the
 * day-picker DOM updates to show all 7 days highlighted, not just that the
 * underlying data is correct, matching the coordinator's acceptance criteria.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BeatNode, FlowAnswers } from '../../types';
import { getAdapter } from '../componentRegistry';

function baseNode(componentType: 'morning-checkin-setup' | 'reflection-card'): BeatNode {
  return {
    id: `demo-${componentType}`,
    type: 'beat',
    beatNumber: 1,
    name: componentType,
    screenId:
      componentType === 'morning-checkin-setup' ? 'ONBOARD-MORNING-SETUP' : 'ONBOARD-BEGINNER-07',
    nextId: null,
    backId: null,
    context: { screenId: '', screenName: '', contextBlock: '' },
    componentType,
    componentProps: {},
    voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
    tool: null,
    persist: null,
  } as unknown as BeatNode;
}

const WEEKDAY_PILL_COUNT = 5;
const ALL_DAYS_PILL_COUNT = 7;

function countActiveDayPills(container: HTMLDivElement): number {
  // DayPicker renders one button per day (0..6); active days carry bg-primary
  // in their class list (see src/components/ui/DayPicker.tsx).
  const buttons = Array.from(container.querySelectorAll('button'));
  return buttons.filter(
    (b) => /size-\[40px\]/.test(b.className) && /\bbg-primary\b/.test(b.className),
  ).length;
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

describe('B53 — morning check-in day-picker resyncs to a later "every day" save', () => {
  it('mounts on the weekday default, then displays all 7 days once answers carry them', () => {
    const Adapter = getAdapter('morning-checkin-setup')!;
    const node = baseNode('morning-checkin-setup');

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={() => {}} />);
    });
    // No saved morningCheckin yet: falls to the locale weekday preset (5 days).
    expect(countActiveDayPills(container)).toBe(WEEKDAY_PILL_COUNT);

    const answersWithDaily: FlowAnswers = {
      morningCheckin: {
        time: '07:30',
        days: [0, 1, 2, 3, 4, 5, 6],
        reminder: true,
        schedule: 'Every day',
      },
    };
    act(() => {
      root.render(<Adapter node={node} answers={answersWithDaily} onCapture={() => {}} />);
    });

    expect(countActiveDayPills(container)).toBe(ALL_DAYS_PILL_COUNT);
  });
});

describe('B53 — evening reflection day-picker resyncs to a later "every night" save', () => {
  it('mounts on the weekday default, then displays all 7 days once answers carry them', () => {
    const Adapter = getAdapter('reflection-card')!;
    const node = baseNode('reflection-card');

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={() => {}} />);
    });
    expect(countActiveDayPills(container)).toBe(WEEKDAY_PILL_COUNT);

    const answersWithDaily: FlowAnswers = {
      reflectionConfig: {
        time: '21:00',
        days: [0, 1, 2, 3, 4, 5, 6],
        reminder: true,
        schedule: 'Every day',
      },
    };
    act(() => {
      root.render(<Adapter node={node} answers={answersWithDaily} onCapture={() => {}} />);
    });

    expect(countActiveDayPills(container)).toBe(ALL_DAYS_PILL_COUNT);
  });
});

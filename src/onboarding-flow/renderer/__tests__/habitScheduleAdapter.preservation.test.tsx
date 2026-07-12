/** @vitest-environment jsdom */
/**
 * Gate 3 — the production HabitScheduleAdapter must preserve EACH habit's own
 * schedule on submit. The old adapter built one shared `base` object from a
 * single schedule card and spread it onto every habit, clobbering per-habit
 * days, time, reminder, and schedule (and it never carried habitType). This test
 * seeds two habits with genuinely distinct configs, renders the REAL adapter
 * (the production export, not a copy), drives its real submit (the Continue tap),
 * and asserts each habit keeps its own values.
 *
 * It fails against the old shared-base spread: with the two seeds below, the old
 * code would hand the SECOND habit the FIRST habit's days/time/reminder/schedule.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HabitType } from '@gg/shared/types';
import type { BeatCapture, FlowAnswers, FlowNode } from '../../types';
import { HabitScheduleAdapter } from '../componentRegistry';

const node = {
  id: 'demo-habit-schedule',
  type: 'beat',
  beatNumber: 1,
  name: 'habit-schedule',
  screenId: 'ONBOARD-BEGINNER-04',
  nextId: null,
  backId: null,
  context: { screenId: '', screenName: '', contextBlock: '' },
  componentType: 'habit-schedule',
  componentProps: {},
  voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
  tool: null,
  persist: null,
} as unknown as FlowNode;

type HabitCfg = {
  days: number[];
  time: string;
  reminder: boolean;
  schedule: string;
  habitType: HabitType;
};

// Two habits, deliberately distinct on every field.
const WALK: HabitCfg = {
  days: [1, 2, 3, 4, 5],
  time: '09:00',
  reminder: true,
  schedule: 'Weekday',
  habitType: 'binary_do',
};
const SNACK: HabitCfg = {
  days: [0, 6],
  time: '20:30',
  reminder: false,
  schedule: 'Weekend',
  habitType: 'binary_avoid',
};

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

function clickContinue() {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Continue',
  );
  if (!btn) throw new Error('Continue button not found');
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('Gate 3 — HabitScheduleAdapter preserves each habit its own schedule', () => {
  it('submits per-habit days/time/reminder/schedule/habitType, not one shared base', () => {
    const onCapture = vi.fn();
    const answers = {
      habitConfigs: { 'Morning walk': WALK, 'No late snacks': SNACK },
    } as unknown as FlowAnswers;

    act(() => {
      root.render(<HabitScheduleAdapter node={node} answers={answers} onCapture={onCapture} />);
    });

    clickContinue();

    expect(onCapture).toHaveBeenCalledTimes(1);
    const payload = onCapture.mock.calls[0][0] as BeatCapture;
    const configs = payload.data.habitConfigs as Record<string, HabitCfg>;

    // Morning walk keeps weekdays + its own time/reminder/schedule + Build type.
    expect(configs['Morning walk']).toEqual(WALK);

    // No late snacks keeps weekends + its own time/reminder/schedule + Break type.
    // The old shared-base spread would have clobbered days/time/reminder/schedule
    // here with the first habit's values (days [1..5], 09:00, reminder true,
    // Weekday), so this assertion is what fails against the old adapter.
    expect(configs['No late snacks']).toEqual(SNACK);
  });
});

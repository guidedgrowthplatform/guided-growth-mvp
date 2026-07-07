/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlowAnswers, FlowNode } from '../../types';
import { getAdapter } from '../componentRegistry';
import { PlanEditProvider, type PatchAnswers } from '../PlanEditContext';

// The into-app adapter IS the plan-review + edit surface. These tests exercise
// the container wiring: a tap edit merges the new habitConfigs into answers and
// persists (via the injected patchAnswers), and confirm advances the machine.
const Adapter = getAdapter('into-app')!;
const NODE = { componentProps: {} } as unknown as FlowNode;

const ANSWERS: FlowAnswers = {
  path: 'simple',
  habitConfigs: {
    Meditate: { days: [1, 2, 3, 4, 5], time: '07:00', reminder: true },
    Workout: { days: [1, 3, 5], time: '18:00', reminder: false },
  },
  reflectionConfig: { time: '21:45', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' },
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

function render(opts: {
  patch?: PatchAnswers | null;
  onCapture?: (c: unknown) => void;
  answers?: FlowAnswers;
}) {
  const onCapture = opts.onCapture ?? (() => {});
  act(() =>
    root.render(
      <PlanEditProvider value={opts.patch ?? null}>
        <Adapter node={NODE} answers={opts.answers ?? ANSWERS} onCapture={onCapture} />
      </PlanEditProvider>,
    ),
  );
}

const buttons = () => Array.from(container.querySelectorAll('button'));
const byAria = (l: string) => container.querySelector(`[aria-label="${l}"]`) as HTMLElement | null;
const byText = (t: string) => buttons().find((b) => b.textContent?.trim() === t);
const click = (el: Element | null | undefined) =>
  act(() => el?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

describe('IntoAppAdapter plan edits', () => {
  it('confirm advances the machine (captures {})', () => {
    const onCapture = vi.fn();
    render({ patch: vi.fn(), onCapture });
    click(byText("Let's go"));
    expect(onCapture).toHaveBeenCalledWith({ data: {} });
  });

  it('remove: drops the habit from habitConfigs and persists', () => {
    const patch = vi.fn();
    render({ patch });
    click(byAria('Edit Meditate'));
    click(byAria('Remove Meditate'));
    expect(patch).toHaveBeenCalledTimes(1);
    const [payload, opts] = patch.mock.calls[0];
    expect(Object.keys(payload.habitConfigs)).toEqual(['Workout']);
    expect(opts).toEqual({ persist: true });
  });

  it('change: a day toggle patches the habit days and persists', () => {
    const patch = vi.fn();
    render({ patch });
    click(byAria('Edit Meditate'));
    const dayPills = buttons().filter((b) => (b.textContent ?? '').trim().length === 1);
    click(dayPills[0]); // Sunday, not selected -> added
    const [payload, opts] = patch.mock.calls[0];
    expect(payload.habitConfigs.Meditate.days).toEqual([0, 1, 2, 3, 4, 5]);
    expect(payload.habitConfigs.Workout).toBeDefined(); // full-map replace keeps the rest
    expect(opts).toEqual({ persist: true });
  });

  it('add: appends a default-config habit and persists', () => {
    const patch = vi.fn();
    render({
      patch,
      answers: { ...ANSWERS, habitConfigs: { Meditate: ANSWERS.habitConfigs!.Meditate } },
    });
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, 'Evening walk');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click(byText('Add habit'));
    const [payload, opts] = patch.mock.calls[0];
    expect(Object.keys(payload.habitConfigs)).toEqual(['Meditate', 'Evening walk']);
    expect(payload.habitConfigs['Evening walk']).toMatchObject({ time: '09:00', reminder: true });
    expect(opts).toEqual({ persist: true });
  });

  it('with no patchAnswers context, renders read-only (no edit affordances)', () => {
    render({ patch: null });
    expect(byAria('Edit Meditate')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(byText("Let's go")).toBeTruthy();
  });
});

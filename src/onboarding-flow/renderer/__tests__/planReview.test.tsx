/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanReview, type PlanReviewProps } from '../PlanReview';
import type { PlanHabit } from '../planReviewData';

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

const HABITS: PlanHabit[] = [
  { name: 'Meditate', days: [1, 2, 3, 4, 5], time: '07:00', reminder: true },
  { name: 'Workout', days: [1, 3, 5], time: '18:00', reminder: false },
];

function render(props: Partial<PlanReviewProps>) {
  const merged: PlanReviewProps = {
    habits: HABITS,
    reflection: { time: '21:45', days: [1, 2, 3, 4, 5], reminder: true },
    morning: { time: '08:00', days: [1, 2, 3, 4, 5], reminder: true },
    weeklyDayIndex: 0,
    habitCap: 2,
    ctaLabel: "Let's go",
    onConfirm: () => {},
    ...props,
  };
  act(() => root.render(<PlanReview {...merged} />));
}

const text = () => container.textContent ?? '';
const buttons = () => Array.from(container.querySelectorAll('button'));
const buttonByText = (t: string) => buttons().find((b) => b.textContent?.trim() === t);
const byAria = (label: string) =>
  container.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;
const click = (el: Element | null | undefined) =>
  act(() => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

describe('PlanReview (read-only)', () => {
  it('renders the whole plan the user built', () => {
    render({});
    expect(text()).toContain('Meditate');
    expect(text()).toContain('Workout');
    expect(text()).toContain('Weekdays'); // Meditate cadence
    expect(text()).toContain('Reminder at 07:00');
    expect(text()).toContain('At 18:00'); // Workout, reminder off
    expect(text()).toContain('Morning check-in');
    expect(text()).toContain('Evening reflection');
    expect(text()).toContain('Weekly review');
    expect(text()).toContain('Sunday');
  });

  it('has no edit affordances and fires onConfirm on the CTA', () => {
    const onConfirm = vi.fn();
    render({ onConfirm });
    expect(byAria('Edit Meditate')).toBeNull();
    expect(byAria('Remove Meditate')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    click(buttonByText("Let's go"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no habits', () => {
    render({ habits: [] });
    expect(text()).toContain('No habits yet');
  });
});

describe('PlanReview (editable)', () => {
  const editProps = () => ({
    onRemoveHabit: vi.fn(),
    onChangeHabit: vi.fn(),
    onAddHabit: vi.fn(),
  });

  it('remove: expand a habit then remove it', () => {
    const p = editProps();
    render(p);
    expect(byAria('Remove Meditate')).toBeNull(); // collapsed
    click(byAria('Edit Meditate'));
    const remove = byAria('Remove Meditate');
    expect(remove).not.toBeNull();
    click(remove);
    expect(p.onRemoveHabit).toHaveBeenCalledWith('Meditate');
  });

  it('change: toggling a day in the editor patches days', () => {
    const p = editProps();
    render(p);
    click(byAria('Edit Meditate'));
    // The only single-letter buttons are the editor's DayPicker (S M T W T F S).
    const dayPills = buttons().filter((b) => (b.textContent ?? '').trim().length === 1);
    expect(dayPills.length).toBe(7);
    click(dayPills[0]); // Sunday (index 0), not currently selected
    expect(p.onChangeHabit).toHaveBeenCalledWith('Meditate', { days: [0, 1, 2, 3, 4, 5] });
  });

  it('change: toggling the reminder patches reminder', () => {
    const p = editProps();
    render(p);
    click(byAria('Edit Meditate'));
    // Toggle renders a role=switch; Meditate reminder starts true -> toggles off.
    const toggle = container.querySelector('[role="switch"]');
    click(toggle);
    expect(p.onChangeHabit).toHaveBeenCalledWith('Meditate', { reminder: false });
  });

  it('add: typing a name and adding calls onAddHabit', () => {
    const p = editProps();
    render({ ...p, habits: [HABITS[0]], habitCap: 2 }); // 1 of 2, under cap
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, 'Evening walk');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click(buttonByText('Add habit'));
    expect(p.onAddHabit).toHaveBeenCalledWith('Evening walk');
  });

  it('cap: at the habit cap the add input is replaced by a cap note', () => {
    const p = editProps();
    render({ ...p, habits: HABITS, habitCap: 2 }); // 2 of 2
    expect(container.querySelector('input')).toBeNull();
    expect(text()).toContain('up to 2 habits');
  });

  it('advanced path cap does not block adding at 2', () => {
    const p = editProps();
    render({ ...p, habits: HABITS, habitCap: 50 });
    expect(container.querySelector('input')).not.toBeNull();
    expect(text()).not.toContain('up to');
  });
});

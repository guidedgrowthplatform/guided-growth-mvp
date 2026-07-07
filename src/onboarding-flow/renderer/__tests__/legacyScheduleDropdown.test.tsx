/** @vitest-environment jsdom */
/**
 * F03 — the legacy "Schedule: Weekday ▾" dropdown row (beats.json's own named
 * legacy artifact, `legacy-schedule-dropdown`) was rendering unconditionally
 * inside DailyReflectionCard for every variant, on habit-schedule,
 * morning-checkin-setup, and reflection-card beats alike. None of those beats'
 * approved renders (gg-spec/tools/visual-qa/runs/2026-07-06-first/render/
 * schedule.png, checkin.png, reflection.png) show that row — only the
 * day-circle picker (plus, for reflection/check-in, their own legitimate
 * time/reminder rows). Assert the dropdown never renders on any of the three
 * beats that share this card.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BeatNode } from '../../types';
import { getAdapter } from '../componentRegistry';

function baseNode(
  componentType: 'habit-schedule' | 'morning-checkin-setup' | 'reflection-card',
): BeatNode {
  return {
    id: `demo-${componentType}`,
    type: 'beat',
    beatNumber: 1,
    name: componentType,
    screenId: componentType,
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

describe.each([
  ['habit-schedule', {}],
  ['morning-checkin-setup', {}],
  ['reflection-card', {}],
] as const)('F03 — no legacy schedule dropdown on %s', (componentType, answers) => {
  it('never renders a "Schedule:" label or the Weekday/Weekend/Every day picker button', () => {
    const Adapter = getAdapter(componentType)!;
    const node = baseNode(componentType);

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    expect(container.textContent).not.toContain('Schedule:');
    ['Weekday', 'Weekend', 'Every day'].forEach((label) => {
      const match = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      );
      expect(match).toBeUndefined();
    });
  });
});

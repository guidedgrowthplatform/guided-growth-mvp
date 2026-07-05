/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrainDumpCapture } from '../BrainDumpCapture';
import type { FlowNode } from '../types';

const NODE = { id: 'advanced-input', screenId: 'ONBOARD-ADVANCED' } as unknown as FlowNode;

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

const cardNames = () =>
  Array.from(container.querySelectorAll('[aria-label="Delete habit"]')).map(
    (d) => d.closest('div.w-full')?.querySelector('span')?.textContent?.trim() ?? '',
  );

describe('BrainDumpCapture typed input — no keystroke-prefix stub cards', () => {
  it('cards only whole-word states while typing, and finalizes clean', () => {
    act(() => {
      root.render(<BrainDumpCapture node={NODE} onCapture={() => {}} />);
    });
    const input = container.querySelector('input')!;
    const setVal = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;

    const TEXT = 'I want to go to the gym monday, quit smoking';
    const seen = new Set<string>();
    for (let i = 1; i <= TEXT.length; i++) {
      act(() => {
        setVal.call(input, TEXT.slice(0, i));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      for (const n of cardNames()) seen.add(n);
    }

    // The run-3 preview defect: mid-word prefixes carding as habits.
    const midWordStubs = [...seen].filter((n) =>
      /^(wa|wan|want t.*|go t|go to t|go to th|quit s.*[^g])$/i.test(n),
    );
    expect(midWordStubs, `mid-word stub cards seen: ${midWordStubs.join(' | ')}`).toEqual([]);

    // Finalize the chunk (LLM call fails silently in jsdom; regex tier stands).
    act(() => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (b) => b.textContent === 'Add',
        ) as HTMLButtonElement
      ).click();
    });
    expect(cardNames()).toEqual(['Go to the gym', 'Quit smoking']);
  });
});

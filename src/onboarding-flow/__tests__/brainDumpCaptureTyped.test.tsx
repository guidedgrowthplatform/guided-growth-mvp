/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBrainDump } from '@/api/parseHabits';
import type { ParsedHabit } from '@gg/shared/types';
import { BrainDumpCapture } from '../BrainDumpCapture';
import type { FlowNode } from '../types';

vi.mock('@/api/parseHabits', () => ({ parseBrainDump: vi.fn() }));
const parseMock = vi.mocked(parseBrainDump);

const NODE = { id: 'advanced-input', screenId: 'ONBOARD-ADVANCED' } as unknown as FlowNode;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  parseMock.mockReset();
  parseMock.mockResolvedValue([]);
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

// The two preview-caught reconcile bugs (!439 note 3498): the AI's clean name is
// often prefix-RELATED to the regex stub, not an extension of it. The stub must
// refine to the AI name (both directions), and a deleted stub must keep the
// AI's version of the same habit dead.
describe('BrainDumpCapture reconcile — AI names own prefix-related stubs', () => {
  function mount() {
    act(() => {
      root.render(<BrainDumpCapture node={NODE} onCapture={() => {}} />);
    });
    const input = container.querySelector('input')!;
    const setVal = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    const typeAll = (text: string) => {
      for (let i = 1; i <= text.length; i++) {
        act(() => {
          setVal.call(input, text.slice(0, i));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    };
    const clickAdd = () =>
      act(() => {
        (
          Array.from(container.querySelectorAll('button')).find(
            (b) => b.textContent === 'Add',
          ) as HTMLButtonElement
        ).click();
      });
    return { typeAll, clickAdd };
  }

  const AI_RESULT: ParsedHabit[] = [
    { name: 'quit smoking', frequency: 'daily', habitType: 'binary_avoid' },
    { name: 'go to the gym', frequency: '3x/week', habitType: 'binary_do' },
    { name: 'drink water in the mornings', frequency: 'daily', habitType: 'binary_do' },
  ];

  it('refines stubs to the AI names in BOTH directions (shorter and longer)', async () => {
    let resolveAI!: (h: ParsedHabit[]) => void;
    parseMock.mockImplementation(() => new Promise((r) => (resolveAI = r)));
    const { typeAll, clickAdd } = mount();

    typeAll(
      'ok so i wanna quit smoking every day, and go to the gym maybe three times a week, drink water in the mornings',
    );
    clickAdd();
    await act(async () => {
      resolveAI(AI_RESULT);
    });

    expect(cardNames().sort()).toEqual([
      'Drink water in the mornings',
      'Go to the gym',
      'Quit smoking',
    ]);
  });

  it('keeps a deleted stub dead when the AI returns the habit under a related name', async () => {
    let resolveAI!: (h: ParsedHabit[]) => void;
    parseMock.mockImplementation(() => new Promise((r) => (resolveAI = r)));
    const { typeAll, clickAdd } = mount();

    typeAll('i wanna quit smoking every ');
    const stubIdx = cardNames().findIndex((n) => /smok/i.test(n));
    expect(stubIdx).toBeGreaterThanOrEqual(0);
    act(() => {
      (
        container.querySelectorAll('[aria-label="Delete habit"]')[stubIdx] as HTMLButtonElement
      ).click();
    });
    expect(cardNames().some((n) => /smok/i.test(n))).toBe(false);

    clickAdd();
    await act(async () => {
      resolveAI([{ name: 'quit smoking', frequency: 'daily', habitType: 'binary_avoid' }]);
    });

    expect(cardNames().some((n) => /smok/i.test(n))).toBe(false);
  });
});

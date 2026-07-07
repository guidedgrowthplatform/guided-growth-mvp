/** @vitest-environment jsdom */
/**
 * Evening reflection (ReflectionSayAdapter, componentType 'reflection').
 *
 * Two bugs reported by a human tester (Mint):
 *  1. Answers were not persisting — because a beat with 0 or partial answers
 *     could still submit, and any blank question was silently dropped from
 *     the joined reflectionText (or, if all were blank, nothing was sent to
 *     the tool at all — see checkinPersistence.test.tsx's "empty text -> no
 *     call" case).
 *  2. A missing/unanswered required question did not re-ask the user, it
 *     just advanced and lost that answer for good.
 *
 * The fix requires every question to be answered before Continue is enabled
 * (mirrors ProfileAdapter's `disabled={!valid}` pattern), so a beat can no
 * longer advance with a partial or empty capture.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeatNode } from '../../types';
import { getAdapter } from '../componentRegistry';

function reflectionNode(): BeatNode {
  return {
    id: 'evening-reflection',
    type: 'beat',
    beatNumber: 4,
    name: 'Evening Reflection',
    screenId: 'ECHECK-REFLECT',
    nextId: 'evening-wrap',
    backId: 'evening-are-you-done',
    context: { screenId: 'ECHECK-REFLECT', screenName: 'Evening Reflection', contextBlock: '' },
    componentType: 'reflection',
    componentProps: {
      questions: [
        { key: 'proud', prompt: 'What are you proud of today?' },
        { key: 'forgive', prompt: 'What do you forgive yourself for today?' },
        { key: 'grateful', prompt: 'What are you grateful for today?' },
      ],
      transition: "Good. Now let's take a moment to reflect on the day itself.",
    },
    voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
    tool: { toolName: 'log_reflection', persistsFields: ['reflectionText'], advancesStep: true },
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

function typeInto(textarea: HTMLTextAreaElement, value: string) {
  const setVal = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!;
  act(() => {
    setVal.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ReflectionSayAdapter — required questions, re-ask instead of drop', () => {
  it('Continue is disabled when every question is still blank', () => {
    const onCapture = vi.fn();
    const Adapter = getAdapter('reflection')!;
    const node = reflectionNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={onCapture} readOnly={false} />);
    });

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);

    act(() => button.click());
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('Continue stays disabled with one of three questions answered (holds the beat, re-asks)', () => {
    const onCapture = vi.fn();
    const Adapter = getAdapter('reflection')!;
    const node = reflectionNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={onCapture} readOnly={false} />);
    });

    const textareas = Array.from(container.querySelectorAll('textarea'));
    expect(textareas).toHaveLength(3);
    typeInto(textareas[0], 'I showed up even though I was tired');

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);

    act(() => button.click());
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('Continue stays disabled with two of three questions answered', () => {
    const onCapture = vi.fn();
    const Adapter = getAdapter('reflection')!;
    const node = reflectionNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={onCapture} readOnly={false} />);
    });

    const textareas = Array.from(container.querySelectorAll('textarea'));
    typeInto(textareas[0], 'I showed up even though I was tired');
    typeInto(textareas[1], 'Skipping my afternoon walk');
    // grateful left blank

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('a whitespace-only answer does not count as answered', () => {
    const onCapture = vi.fn();
    const Adapter = getAdapter('reflection')!;
    const node = reflectionNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={onCapture} readOnly={false} />);
    });

    const textareas = Array.from(container.querySelectorAll('textarea'));
    typeInto(textareas[0], 'I showed up even though I was tired');
    typeInto(textareas[1], 'Skipping my afternoon walk');
    typeInto(textareas[2], '   ');

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);
  });

  it('Continue enables once all three are answered, and captures the full joined text (persists every answer)', () => {
    const onCapture = vi.fn();
    const Adapter = getAdapter('reflection')!;
    const node = reflectionNode();

    act(() => {
      root.render(<Adapter node={node} answers={{}} onCapture={onCapture} readOnly={false} />);
    });

    const textareas = Array.from(container.querySelectorAll('textarea'));
    typeInto(textareas[0], 'I showed up even though I was tired');
    typeInto(textareas[1], 'Skipping my afternoon walk');
    typeInto(textareas[2], 'A good talk with my brother');

    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(false);

    act(() => button.click());

    expect(onCapture).toHaveBeenCalledTimes(1);
    const captured = onCapture.mock.calls[0][0] as { data: { reflectionText: string } };
    expect(captured.data.reflectionText).toBe(
      [
        'What are you proud of today? I showed up even though I was tired',
        'What do you forgive yourself for today? Skipping my afternoon walk',
        'What are you grateful for today? A good talk with my brother',
      ].join('\n'),
    );
  });
});

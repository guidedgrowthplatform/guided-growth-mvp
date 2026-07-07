/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// B57: the reflection-setup mode picker must default to reading as "Daily
// Reflection" (the coach's narrated guided default) when mode is 'prompts'
// and the user hasn't entered any custom prompts yet. It should only read as
// "Custom Prompts" once the user actually adds one, since 'prompts' mode
// covers both the guided default and a genuinely customized list.
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REFLECTION_PROMPTS } from '@gg/shared/types';
import { ReflectionModeEditor } from '../ReflectionModeEditor';

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

describe('ReflectionModeEditor', () => {
  it('reads as "Daily Reflection" on mount with mode=prompts and no prior prompts (B57 default)', () => {
    act(() => {
      root.render(
        <ReflectionModeEditor
          mode="prompts"
          onModeChange={vi.fn()}
          prompts={[]}
          onPromptsChange={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('Daily Reflection');
    expect(container.textContent).not.toContain('Custom Prompts');
  });

  it('default state references the daily questions once, no required-prompt demand', () => {
    act(() => {
      root.render(
        <ReflectionModeEditor
          mode="prompts"
          onModeChange={vi.fn()}
          prompts={[]}
          onPromptsChange={vi.fn()}
        />,
      );
    });
    // The questions themselves render once on the beat, in DailyReflectionCard
    // above this editor; the editor only references them.
    expect(container.textContent).toContain("You'll answer the three daily questions shown above.");
    for (const q of DEFAULT_REFLECTION_PROMPTS) {
      expect(container.textContent).not.toContain(q);
    }
    expect(container.textContent).not.toContain('Add at least 1 prompt:');
    expect(container.textContent).toContain('Want your own questions instead?');
  });

  it('custom state keeps the editor demand and drops the default-question reference', () => {
    act(() => {
      root.render(
        <ReflectionModeEditor
          mode="prompts"
          onModeChange={vi.fn()}
          prompts={['What went well today?']}
          onPromptsChange={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('Add at least 1 prompt:');
    expect(container.textContent).not.toContain(
      "You'll answer the three daily questions shown above.",
    );
  });

  it('reads as "Custom Prompts" once the user has entered at least one prompt', () => {
    act(() => {
      root.render(
        <ReflectionModeEditor
          mode="prompts"
          onModeChange={vi.fn()}
          prompts={['What went well today?']}
          onPromptsChange={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('Custom Prompts');
    expect(container.textContent).not.toContain('Daily Reflection');
  });

  it('does not read as "Custom Prompts" when the only entries are blank/whitespace', () => {
    act(() => {
      root.render(
        <ReflectionModeEditor
          mode="prompts"
          onModeChange={vi.fn()}
          prompts={['   ', '']}
          onPromptsChange={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('Daily Reflection');
    expect(container.textContent).not.toContain('Custom Prompts');
  });

  it('shows Freeform, unselected, when mode is prompts', () => {
    act(() => {
      root.render(
        <ReflectionModeEditor
          mode="prompts"
          onModeChange={vi.fn()}
          prompts={[]}
          onPromptsChange={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('Freeform');
  });
});

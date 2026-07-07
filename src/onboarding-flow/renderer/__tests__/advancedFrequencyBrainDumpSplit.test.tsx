/** @vitest-environment jsdom */
/**
 * F10 layer 1 (live path) — the advanced-frequency beat is the one that
 * actually renders after the coach's submit_brain_dump on the LIVE/Vapi and
 * Direct-LLM advance path: submit_brain_dump only ever persists raw
 * brainDumpText server-side (see api/_lib/llm/onboarding/handlers/
 * submitBrainDump.ts and api/_lib/vapi/handlers/submitBrainDump.ts, both of
 * which write ONLY brainDumpText, never a per-habit split), and the beat
 * advances via the orchestrator's server-driven leading-edge climb watcher
 * (useFlowOrchestrator.ts), replaying serverCaptureForBeat's reconstruction —
 * never BrainDumpCapture.tsx's own submit(), whose F10/F27 fix (1118714d)
 * only guards that component's own client-typed/local-mic path. So the beat
 * that actually renders here is AdvancedFrequencyAdapter, seeded from
 * answers.brainDumpText alone (answers.brainDumpHabits and answers.habitConfigs
 * both empty), which used to fall back to a narrower comma/newline-only split
 * AND, when that produced nothing, to a hardcoded SAMPLE array containing
 * "No screens after 10 PM" (the second QA-observed layer: a real user's
 * collapsed habit silently swapping to unrelated, never-typed content).
 *
 * These tests render AdvancedFrequencyAdapter directly with exactly the shape
 * the live path hands it (brainDumpText only) and assert: (1) a period-only
 * dump with no commas/"and" splits into 3 separate cards, matching the fixed
 * parseHabitsRegex; (2) no SAMPLE/fabricated habit name ever renders.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BeatNode, FlowAnswers } from '../../types';
import { getAdapter } from '../componentRegistry';

function baseNode(): BeatNode {
  return {
    id: 'advanced-frequency',
    type: 'beat',
    beatNumber: 5,
    name: 'Habit Days (Advanced)',
    screenId: 'ONBOARD-ADVANCED-FREQUENCY',
    nextId: null,
    backId: 'advanced-input',
    context: { screenId: '', screenName: '', contextBlock: '' },
    componentType: 'advanced-frequency',
    componentProps: {},
    voice: { openerText: null, expectsInput: true, directLlmAllowed: true },
    tool: null,
    persist: null,
  } as unknown as BeatNode;
}

function cardNames(container: HTMLDivElement): string[] {
  // Each habit renders its name in a span with this class (see
  // AdvancedFrequencyAdapter in componentRegistry.tsx).
  return Array.from(container.querySelectorAll('span.text-\\[15px\\].font-semibold')).map(
    (el) => el.textContent ?? '',
  );
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

describe('F10 layer 1 (live path) — AdvancedFrequencyAdapter splits brainDumpText, not just BrainDumpCapture', () => {
  it('splits a period-only, no-comma/no-"and" dump into 3 separate cards (the exact repro string)', () => {
    const Adapter = getAdapter('advanced-frequency')!;
    const node = baseNode();
    const answers: FlowAnswers = {
      brainDumpText: 'Walking. Reading. Drinking more water.',
    } as unknown as FlowAnswers;

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    expect(cardNames(container)).toEqual(['Walking', 'Reading', 'Drinking more water']);
  });

  it('splits the exact round-2 QA repro string into 3 separate cards (not one combined name)', () => {
    const Adapter = getAdapter('advanced-frequency')!;
    const node = baseNode();
    const answers: FlowAnswers = {
      brainDumpText: 'Meditate every morning. Journal before bed. Walk after lunch.',
    } as unknown as FlowAnswers;

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    // parseHabitsRegex strips the cadence phrase "every morning" from the name
    // (the day-picker on this very beat is where that cadence belongs, not the
    // habit's name) — this matches the shared splitter's existing, already-
    // tested behavior. The point of this assertion is 3 distinct cards, never
    // the single combined sentence the live bug produced.
    const names = cardNames(container);
    expect(names).toHaveLength(3);
    expect(names).toEqual(['Meditate', 'Journal before bed', 'Walk after lunch']);
    expect(names.join(' ')).not.toContain('Meditate every morning. Journal before bed');
  });

  it('still splits a comma-separated dump correctly (no regression on the already-working case)', () => {
    const Adapter = getAdapter('advanced-frequency')!;
    const node = baseNode();
    const answers: FlowAnswers = {
      brainDumpText: 'go to the gym, meditate daily, read before bed',
    } as unknown as FlowAnswers;

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    expect(cardNames(container)).toEqual(['go to the gym', 'meditate', 'read before bed']);
  });

  it('never fabricates a SAMPLE habit (e.g. "No screens after 10 PM") when the dump is empty', () => {
    const Adapter = getAdapter('advanced-frequency')!;
    const node = baseNode();
    const answers: FlowAnswers = {} as unknown as FlowAnswers;

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    expect(cardNames(container)).toEqual([]);
    expect(container.textContent ?? '').not.toContain('No screens after 10 PM');
  });

  it('prefers already-configured habitConfigs / skimmer cards over the raw-dump split when present', () => {
    const Adapter = getAdapter('advanced-frequency')!;
    const node = baseNode();
    const answers: FlowAnswers = {
      brainDumpText: 'Walking. Reading. Drinking more water.',
      brainDumpHabits: [{ name: 'Walking' }, { name: 'Reading' }, { name: 'Drinking more water' }],
    } as unknown as FlowAnswers;

    act(() => {
      root.render(<Adapter node={node} answers={answers} onCapture={() => {}} />);
    });

    expect(cardNames(container)).toEqual(['Walking', 'Reading', 'Drinking more water']);
  });
});

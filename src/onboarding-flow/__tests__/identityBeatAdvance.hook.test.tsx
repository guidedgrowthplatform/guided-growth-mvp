/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B47: the live advance for the post-lane setup beats (state-check, morning,
 * reflection, weekly-day) is EVIDENCE-driven, not step-climb driven. Their
 * tools GREATEST-bump current_step only to their own step (6..9), which the
 * advance ladder's one-ahead seam (habit-schedule bare-sets 7) has already met
 * or passed by the time each beat is active, so a serverStep climb never
 * arrives for them off a real server write. The orchestrator must advance the
 * moment the row proves the beat completed, at a CONSTANT current_step, and
 * must hold a beat that was entered with its evidence already present
 * (back-nav / replay semantics, mirroring the fork's evidence-arrival rule).
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingState } from '@gg/shared/types';
import { loadPublishedFlow } from '../useFlow';
import { useFlowOrchestrator, type FlowOrchestrator } from '../useFlowOrchestrator';

vi.mock('@/contexts/useOnboardingVoiceSession', () => ({
  useOnboardingVoice: () => null,
}));

let serverState: OnboardingState | null = null;
vi.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ state: serverState }),
}));

vi.mock('@/lib/telemetry/latencySpans', () => ({
  settleBeatTransition: vi.fn(),
  markBeatTransition: vi.fn(),
}));

const flow = loadPublishedFlow();
const persistence = { saveStep: vi.fn(), complete: vi.fn() };

let container: HTMLDivElement;
let root: Root;
let latest: FlowOrchestrator | null = null;

function Probe({ startAt }: { startAt: string }) {
  latest = useFlowOrchestrator(flow, persistence, { startAtNodeId: startAt });
  return null;
}

function render(startAt: string) {
  act(() => {
    root.render(<Probe startAt={startAt} />);
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// The row shape a real run holds by the time the setup block starts: the
// positional window is complete and the ladder's one-ahead seam parked
// current_step at 7 (habit-schedule's bare-set target).
const POSITIONAL_DATA = {
  nickname: 'Fable',
  age: 30,
  gender: 'Male',
  category: 'Health & Fitness',
  goals: ['Move daily'],
  habitConfigs: { Walking: { days: [1, 2, 3], time: '08:00', reminder: true } },
};

function rowAt(step: number, data: Record<string, unknown>): OnboardingState {
  return {
    current_step: step,
    status: 'in_progress',
    path: 'simple',
    data,
  } as unknown as OnboardingState;
}

beforeEach(() => {
  serverState = null;
  latest = null;
  persistence.saveStep.mockClear();
  persistence.complete.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('identity-beat evidence advance (B47)', () => {
  it('state-check advances on stateCheck evidence arrival with NO current_step climb', async () => {
    serverState = rowAt(7, POSITIONAL_DATA);
    render('state-check');
    await flush();
    expect(latest!.currentNode?.id).toBe('state-check');

    // The record_checkin result lands: same step (GREATEST(7, 6) = 7), new data.
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 4, sleep: 3 } });
    render('state-check');
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
    // Coach-driven advance: the server already saved; no duplicate client write.
    expect(persistence.saveStep).not.toHaveBeenCalled();
  });

  it('the chain continues: morning evidence advances to reflection, still no climb', async () => {
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 4 } });
    render('morning-checkin-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    serverState = rowAt(7, {
      ...POSITIONAL_DATA,
      stateCheck: { mood: 4 },
      morningCheckin: { time: '08:00', days: [1, 2, 3], reminder: true },
    });
    render('morning-checkin-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('reflection-setup');
  });

  it('holds a beat entered with its evidence already present (back-nav semantics)', async () => {
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 4 } });
    render('state-check');
    await flush();
    // Entered WITH stateCheck already saved: stale evidence must not yank the
    // user forward off a revisited beat.
    expect(latest!.currentNode?.id).toBe('state-check');
  });

  it('captureFor drops a stale capture once the machine moved past its beat (B47 race)', async () => {
    serverState = rowAt(3, POSITIONAL_DATA);
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');

    // A stale auto-submit computed for a DIFFERENT beat must be a no-op.
    await act(async () => {
      latest!.captureFor('profile', { data: { age: 30, gender: 'Male' } });
    });
    expect(latest!.currentNode?.id).toBe('category');

    // The scoped capture for the ACTIVE beat still advances normally.
    await act(async () => {
      latest!.captureFor('category', { data: { category: 'Health & Fitness' } });
    });
    expect(latest!.currentNode?.id).toBe('goals');
  });

  it('positional-window beats are untouched by the evidence rule (climb owns them)', async () => {
    // Category with its own answer already in the row but no step climb: the
    // evidence rule must not fire (entryServerStep is defined there), so the
    // beat holds until a real climb arrives.
    serverState = rowAt(3, { ...POSITIONAL_DATA });
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');
  });
});

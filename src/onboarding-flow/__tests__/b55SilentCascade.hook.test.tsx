/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B55: the unattended beat cascade found live in the RESISTER persona round-1
 * QA walk (qa-rounds/round1/resister/trail.md, turns 05-09). With the tester
 * only passively polling (zero sendTurn / capture calls), the flow advanced
 * path-fork -> category -> goals -> habit-select -> habit-schedule ->
 * morning-checkin-setup -> reflection-setup on its own, silently defaulting a
 * path, a category, and a goal along the way.
 *
 * Root cause: the fork's evidence-arrival advance and the identity-beat
 * evidence-arrival advance (useFlowOrchestrator.ts) both walked the machine
 * forward the moment `serverData` carried a beat's completion field, with no
 * check on how that field got there. `beatCompletionEvidence` only asks "is
 * the field non-null", never "did a genuine, user-attributable save just
 * happen for THIS beat, on THIS visit". `serverData` is a union of every
 * field the row has ever held (mergeRealtimeRow unions `data`), so a field
 * that was already sitting in the row before this beat became active (a
 * stale/queued write, a realtime echo, carried-over state) satisfies the
 * evidence check the instant the machine arrives there — with zero user
 * action in between. That is exactly the observed multi-beat cascade.
 *
 * Fix: both evidence-arrival effects now also require `hasFreshServerWrite`
 * — the row's `updated_at` must be strictly newer than the value captured
 * when the beat became active, proving a real write happened WHILE this beat
 * was being watched, not before. Legitimate advances (Vapi/Direct-LLM saving
 * a beat while it is genuinely active, which always bumps `updated_at`) are
 * unaffected; evidence that was already present with a stale timestamp can
 * never advance the beat again.
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

function rowAt(
  step: number,
  data: Record<string, unknown>,
  path: string | null,
  updatedAt: string,
): OnboardingState {
  return {
    current_step: step,
    status: 'in_progress',
    path,
    data,
    updated_at: updatedAt,
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

const T0 = '2026-07-07T00:00:00.000Z';
const T1 = '2026-07-07T00:00:05.000Z';

describe('B55: unattended silent cascade must not advance a beat with no fresh server write', () => {
  it('holds at the fork forever when a path value is present but the row was never freshly written to while the fork was active (the cascade shape)', async () => {
    // Entered the fork fresh — no path yet, row stamped T0.
    serverState = rowAt(2, { nickname: 'Alejandro', age: 52, gender: 'Male' }, null, T0);
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('path-fork');

    // A path value appears — but `updated_at` is STILL T0 (no genuine new
    // write since the fork became active; this is the stale-union shape:
    // data present, but nothing was ever written while we were watching).
    serverState = rowAt(2, { nickname: 'Alejandro', age: 52, gender: 'Male' }, 'simple', T0);
    render('path-fork');
    await flush();
    // MUST hold — no fresh write proves the user actually chose this.
    expect(latest!.currentNode?.id).toBe('path-fork');

    // Keep polling with the same stale timestamp — must never advance, no
    // matter how much time passes or how many times the row is re-read.
    serverState = rowAt(
      2,
      { nickname: 'Alejandro', age: 52, gender: 'Male', category: 'Sleep better' },
      'simple',
      T0,
    );
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('path-fork');
  });

  it('legitimate case: a genuinely fresh write (updated_at climbs) still advances the fork normally', async () => {
    serverState = rowAt(2, { nickname: 'Alejandro', age: 52, gender: 'Male' }, null, T0);
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('path-fork');

    // A real save happens while the fork is active: path appears AND
    // updated_at climbs past the entry baseline — this is what a genuine
    // Vapi/Direct-LLM submit_path_choice looks like from the client's view.
    serverState = rowAt(2, { nickname: 'Alejandro', age: 52, gender: 'Male' }, 'simple', T1);
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');
  });

  it('holds an identity beat (morning-checkin-setup) whose evidence is present but stale, mirroring the resister-advanced refusal-override shape', async () => {
    const POSITIONAL_DATA = {
      nickname: 'Timothy',
      age: 52,
      gender: 'Male',
      category: 'Sleep better',
      goals: ['Fall asleep earlier'],
      habitConfigs: { Walking: { days: [1, 2, 3], time: '08:00', reminder: true } },
    };
    serverState = rowAt(7, POSITIONAL_DATA, 'simple', T0);
    render('morning-checkin-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    // morningCheckin evidence shows up, but the row's updated_at never moved
    // past the entry baseline — no proof of a fresh save while this beat was
    // being watched. Must hold, never silently advance/default.
    serverState = rowAt(
      7,
      {
        ...POSITIONAL_DATA,
        morningCheckin: {
          time: '08:00',
          days: [0, 1, 2, 3, 4, 5, 6],
          reminder: true,
          schedule: 'Every day',
        },
      },
      'simple',
      T0,
    );
    render('morning-checkin-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
  });

  it('critical non-regression: a beat entered with NO server row yet (fresh account, nothing loaded) still advances on the first real save', async () => {
    // No server row at all when the fork first mounts — the common case for a
    // brand-new account before Realtime has delivered anything.
    serverState = null;
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('path-fork');

    // The row is created (nickname-seed write from FlowOnboarding's mount
    // effect lands first in the real app) — no path yet. This is the FIRST
    // observation of a real row, so it correctly becomes the entry baseline.
    serverState = rowAt(2, { nickname: 'Alejandro' }, null, T0);
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('path-fork');

    // The real save lands while the fork is active: path appears AND
    // updated_at climbs past the entry baseline.
    serverState = rowAt(2, { nickname: 'Alejandro', age: 52, gender: 'Male' }, 'simple', T1);
    render('path-fork');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');
  });
});

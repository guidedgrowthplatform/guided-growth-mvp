/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * W3-A repro: reconstruct the round-3 RESISTER trail's post-reset idle cascade
 * (qa-rounds/round3/resister/trail.md, turns 15-16) beat-by-beat against the
 * real orchestrator, to find exactly which render lets `weekly-day-setup`
 * advance with zero LLM calls.
 *
 * Trail shape: state-check answered for real (fresh write) -> morning-checkin
 * REFUSED (submit_morning_checkin blocked server-side, ok:false, NO db write)
 * -> user says "Yes lets do the evening reflection now" (0 LLM calls, purely
 * client-side transition to reflection-setup) -> then an unattended idle hold
 * cascades reflection-setup -> weekly-day-setup -> into-app with zero LLM
 * calls the whole time.
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

const T_STATECHECK = '2026-07-07T00:00:00.000Z'; // state-check's real save

const POSITIONAL_DATA = {
  nickname: 'Alejandro',
  age: 52,
  gender: 'Male',
  category: 'Sleep',
  goals: ['Fall asleep earlier'],
  habitConfigs: { 'No screens after 10 PM': { days: [0, 1, 2, 3, 4, 5, 6], time: '21:00' } },
};

describe('W3-A repro: post-reset idle cascade at reflection-setup / weekly-day-setup', () => {
  it('holds at morning-checkin-setup forever when submit_morning_checkin is refused (no write, no evidence)', async () => {
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 2 } }, 'simple', T_STATECHECK);
    render('morning-checkin-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    // Refusal: guard blocks server-side, handlerError returns BEFORE any db
    // write. Row is byte-for-byte unchanged (same updated_at, no morningCheckin).
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 2 } }, 'simple', T_STATECHECK);
    render('morning-checkin-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
  });

  it('reflection-setup: entered via a client-side transition (no server evidence yet) must NOT self-advance on an unrelated later write', async () => {
    // Simulates: morning-checkin-setup was left by SOME client-side transition
    // (matching the trail's "0 LLM calls this turn" transition) while the row
    // still has NO morningCheckin and NO reflectionConfig. reflection-setup
    // becomes active with the row exactly as it was.
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 2 } }, 'simple', T_STATECHECK);
    render('reflection-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('reflection-setup');

    // Idle hold: the SAME row is re-observed (a poll / re-render), still no
    // reflectionConfig, still the same updated_at. Must hold indefinitely.
    for (let i = 0; i < 5; i++) {
      serverState = rowAt(
        7,
        { ...POSITIONAL_DATA, stateCheck: { mood: 2 } },
        'simple',
        T_STATECHECK,
      );
      render('reflection-setup');
      await flush();
      expect(latest!.currentNode?.id).toBe('reflection-setup');
    }
    expect(persistence.saveStep).not.toHaveBeenCalled();
  });

  it('CASCADE REPRO: reflection-setup entered with entryUpdatedAtRef baseline UNDEFINED (no server row observed yet on this beat) lets stale reflectionConfig evidence through', async () => {
    // The critical case: reflection-setup becomes active BEFORE any server row
    // has been observed for it yet in this render pass (serverStep is a number
    // already from state-check's real climb, but suppose the local render that
    // sets activeNodeId to reflection-setup races ahead of a serverState value
    // — reproduced here by entering reflection-setup with serverState === null
    // first (the "no baseline" exemption), THEN a stale row with unrelated
    // stateCheck/morningCheckin data (no reflectionConfig) arrives.
    serverState = null;
    render('reflection-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('reflection-setup');

    // First real row observed while this beat is active (any row now reads as
    // "fresh" per hasFreshServerWrite's no-baseline exemption) — no
    // reflectionConfig, so evidence is still false: must not advance yet.
    serverState = rowAt(7, { ...POSITIONAL_DATA, stateCheck: { mood: 2 } }, 'simple', T_STATECHECK);
    render('reflection-setup');
    await flush();
    expect(latest!.currentNode?.id).toBe('reflection-setup');
  });
});

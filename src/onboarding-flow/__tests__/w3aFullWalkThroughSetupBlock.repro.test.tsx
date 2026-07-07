/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * W3-A: reconstruct the round-3 RESISTER trail's post-reset idle cascade
 * (qa-rounds/round3/resister/trail.md turns 15-16) beat-by-beat against the
 * real orchestrator, mounted ONCE (not re-mounted per beat like the other
 * hook tests) so effect ordering across a real beat-to-beat transition is
 * exercised exactly like the real FlowOnboarding component.
 *
 * Root cause identified (see the doc comment on VAPI_UNGUARDED_SETUP_SCREENS
 * in useFlowOrchestrator.ts): ONBOARD-MORNING-SETUP and ONBOARD-BEGINNER-07
 * (reflection) are both Vapi-armed (CHAT_VAPI_BEAT_SCREENS,
 * voiceIn.engine='vapi'), but their Vapi tool handlers
 * (api/_lib/vapi/handlers/submitMorningCheckin.ts,
 * .../submitReflectionConfig.ts) carry NO refusal/grounding guard — an
 * explicit, documented gap ("the Vapi webhook payload never carries the raw
 * user turn text this guard needs"). The round-3 QA build had
 * VITE_ONBOARDING_VAPI_IDLE_TIMEOUT_MS overridden long for testing
 * convenience (docs/vapi-onboarding-handoff.md), so Vapi stayed live and
 * listening well past the tester's own idle hold. If Vapi's own assistant
 * calls submit_morning_checkin / submit_reflection_config with
 * schema-valid-but-fabricated args (misheard ambient audio, a model
 * hallucination, anything), the write is genuinely FRESH (hasFreshServerWrite
 * correctly reads it as such — the row really was written to while the beat
 * was active) even though no real user intent produced it. This is
 * indistinguishable from a real save via updated_at alone, which is why the
 * QA harness measured "0 LLM calls" for the whole cascade (Vapi tool calls
 * land server-to-server via a webhook, never through the browser's
 * /api/llm network, so no client-side instrumentation sees them).
 *
 * Fix: for these two screens only, the identity-beat evidence-arrival advance
 * also requires a real user transcript event since the beat became active
 * (VAPI_UNGUARDED_SETUP_SCREENS + hasGenuineVoiceEngagement). A genuine save
 * (voice OR text) always has one; an unattended phantom Vapi call does not.
 */
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingTranscriptListener } from '@/contexts/useOnboardingVoiceSession';
import type { OnboardingState } from '@gg/shared/types';
import { loadPublishedFlow } from '../useFlow';
import { useFlowOrchestrator, type FlowOrchestrator } from '../useFlowOrchestrator';

let transcriptListener: OnboardingTranscriptListener | null = null;
function emitUserTranscript(text = 'ok'): void {
  transcriptListener?.({ role: 'user', kind: 'final', text });
}
vi.mock('@/contexts/useOnboardingVoiceSession', () => ({
  useOnboardingVoice: () => ({
    subscribeTranscripts: (listener: OnboardingTranscriptListener) => {
      transcriptListener = listener;
      return () => {
        transcriptListener = null;
      };
    },
    registerScreen: () => {},
    setFormSnapshot: () => {},
  }),
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

// Single continuously-mounted probe (no remount between renders) — startAt is
// only applied once, on first mount, exactly like the real FlowOnboarding.
function Probe({ startAt }: { startAt: string }) {
  latest = useFlowOrchestrator(flow, persistence, { startAtNodeId: startAt });
  return null;
}

function rerender() {
  act(() => {
    root.render(<Probe startAt="state-check" />);
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
  transcriptListener = null;
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

const T0 = '2026-07-07T00:00:00.000Z'; // account created / reset baseline
const T1 = '2026-07-07T00:00:05.000Z'; // state-check real save
const T2 = '2026-07-07T00:00:10.000Z'; // some other real write (NOT morningCheckin/reflectionConfig)
const T3 = '2026-07-07T00:05:00.000Z'; // the phantom Vapi write, minutes later (idle hold)

const BASE = {
  nickname: 'Alejandro',
  age: 52,
  gender: 'Male',
  category: 'Sleep',
  goals: ['Fall asleep earlier'],
  habitConfigs: { 'No screens after 10 PM': { days: [0, 1, 2, 3, 4, 5, 6], time: '21:00' } },
};

describe('W3-A: single-mount walk through the setup block, mirroring a real continuous session', () => {
  it('does not let reflection-setup or weekly-day-setup advance off an UNRELATED fresh write once morning-checkin-setup is active', async () => {
    // Mount fresh (post-reset), no row yet.
    serverState = null;
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('state-check');

    // First row observed while state-check is active: no stateCheck yet (this
    // becomes the entry baseline, matching a real post-reset walk where the
    // positional-window beats were already answered before state-check).
    serverState = rowAt(6, { ...BASE }, 'simple', T0);
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('state-check');

    // state-check answered for real (fresh write: stateCheck appears, updated_at climbs).
    emitUserTranscript('sleep was fine, mood ok');
    serverState = rowAt(6, { ...BASE, stateCheck: { mood: 2 } }, 'simple', T1);
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    // Refusal turn: submit_morning_checkin blocked server-side -- genuinely NO
    // db write at all, row byte-for-byte identical.
    emitUserTranscript('I do not want a morning thing at all');
    serverState = rowAt(7, { ...BASE, stateCheck: { mood: 2 } }, 'simple', T1);
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    // Some UNRELATED write happens (e.g. a session_log insert, a profile
    // touch, anything that bumps updated_at on this row WITHOUT ever setting
    // morningCheckin). This models "something else wrote to the row while
    // morning-checkin-setup was active."
    serverState = rowAt(7, { ...BASE, stateCheck: { mood: 2 } }, 'simple', T2);
    rerender();
    await flush();
    // MUST still hold: updated_at climbed, but morningCheckin is still absent,
    // so beatCompletionEvidence is still false regardless of freshness.
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
    expect(persistence.saveStep).not.toHaveBeenCalled();

    // Idle indefinitely: re-observe the SAME row repeatedly. Must never budge.
    for (let i = 0; i < 10; i++) {
      serverState = rowAt(7, { ...BASE, stateCheck: { mood: 2 } }, 'simple', T2);
      rerender();
      await flush();
      expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
    }
  });

  it('W3-A CASCADE REPRO: an unattended phantom Vapi write (morningCheckin appears, fresh, NO transcript) must NOT advance past morning-checkin-setup', async () => {
    serverState = null;
    rerender();
    await flush();
    emitUserTranscript('sleep was fine');
    serverState = rowAt(6, { ...BASE }, 'simple', T0);
    rerender();
    await flush();
    serverState = rowAt(6, { ...BASE, stateCheck: { mood: 2 } }, 'simple', T1);
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    // NO further transcript event fires here — this beat's own
    // sawVoiceActivitySinceEntryRef never flips (mirrors the trail: the
    // refused turn is the LAST real user text the tester sent before going
    // idle; nothing else was said on this beat).
    //
    // Minutes later (idle hold), morningCheckin appears with a fresh
    // updated_at — Vapi's own assistant firing submit_morning_checkin with
    // fabricated-but-schema-valid args, no real user behind it.
    serverState = rowAt(
      7,
      {
        ...BASE,
        stateCheck: { mood: 2 },
        morningCheckin: { time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], reminder: true },
      },
      'simple',
      T3,
    );
    rerender();
    await flush();
    // MUST hold: hasFreshServerWrite alone is satisfied (write is genuinely
    // newer than entry), but hasGenuineVoiceEngagement is not.
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
    expect(persistence.saveStep).not.toHaveBeenCalled();

    // Idle indefinitely from here: still holds, over and over.
    for (let i = 0; i < 5; i++) {
      rerender();
      await flush();
      expect(latest!.currentNode?.id).toBe('morning-checkin-setup');
    }
  });

  it('non-regression: GENUINE voice saves (morningCheckin/reflection appear WITH real transcript events) advance the whole setup block to the fork', async () => {
    serverState = null;
    rerender();
    await flush();
    emitUserTranscript('sleep was fine');
    serverState = rowAt(6, { ...BASE }, 'simple', T0);
    rerender();
    await flush();
    serverState = rowAt(6, { ...BASE, stateCheck: { mood: 2 } }, 'simple', T1);
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('morning-checkin-setup');

    // Real user answers by voice: a transcript event fires, THEN the save lands.
    emitUserTranscript('9pm every day, with a reminder');
    serverState = rowAt(
      7,
      {
        ...BASE,
        stateCheck: { mood: 2 },
        morningCheckin: { time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], reminder: true },
      },
      'simple',
      T3,
    );
    rerender();
    await flush();
    expect(latest!.currentNode?.id).toBe('reflection-setup');

    // Reflection: same pattern, real transcript then real save.
    emitUserTranscript('yes let us set up the evening reflection too');
    serverState = rowAt(
      8,
      {
        ...BASE,
        stateCheck: { mood: 2 },
        morningCheckin: { time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], reminder: true },
        reflectionConfig: {
          time: '21:45',
          days: [0, 1, 2, 3, 4, 5, 6],
          reminder: true,
          schedule: 'Every day',
        },
      },
      'simple',
      '2026-07-07T00:06:00.000Z',
    );
    rerender();
    await flush();
    // Rhythm-first: reflection is the last setup beat, so it advances to the
    // fork (weekly-day-setup is cut). The row already carries path='simple'
    // (a positional-window answer from before the setup block), so the fork
    // then HOLDS on its pre-existing answer and the machine settles at the fork.
    expect(latest!.currentNode?.id).toBe('path-fork');
    for (let i = 0; i < 3; i++) {
      rerender();
      await flush();
      expect(latest!.currentNode?.id).toBe('path-fork');
    }
  });
});

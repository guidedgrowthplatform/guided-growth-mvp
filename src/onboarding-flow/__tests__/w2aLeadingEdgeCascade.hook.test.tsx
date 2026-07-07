/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * W2-A: the unattended multi-beat auto-complete/replay cascade found live in
 * two rounds of persona QA (qa-rounds/round1/resister/trail.md turns 05-09,
 * qa-rounds/round2/resister-advanced/trail.md and
 * qa-rounds/round2/cooperative/trail.md turn 5-6). With the tester only
 * passively polling (zero sendTurn / capture / captureFor calls, confirmed via
 * an `llmDump` op showing exactly ONE total LLM call across the ENTIRE
 * cascaded session), the flow auto-advanced through path-fork -> category ->
 * goals -> habit-select -> habit-schedule -> state-check ->
 * morning-checkin-setup -> reflection-setup -> weekly-day-setup, fabricating
 * an age/gender, a path choice, a realistic brain-dump free-text
 * ("gym 4x, meditate daily, no soda"), a category, goals, habits, and a
 * scripted "Checked in." user bubble, all persisted to the real account.
 *
 * B55 (commit b9dfe05f) added a `hasFreshServerWrite` freshness guard to two
 * of the three evidence-arrival advances in useFlowOrchestrator.ts (the fork
 * and the identity/setup-beat effects), closing the cascade for
 * state-check/morning-checkin-setup/reflection-setup/weekly-day-setup. It did
 * NOT touch the third advance path — the LEADING-EDGE CLIMB effect that owns
 * every "positional window" beat (profile, path-fork, category, goals,
 * habit-select, habit-schedule — persist steps 1..5). That effect advances on
 * any `current_step` climb past the beat's own step, with a DATA-completeness
 * gate (captureCompletesBeat) but no freshness check on `updated_at`. Because
 * `serverData` is a union of every field the row has ever held
 * (mergeRealtimeRow unions `data`) and `current_step` itself can climb from
 * ANY write to the row (a queued/stale write, a resume-adjacent bump, an
 * out-of-order Realtime echo), a single stale climb satisfies
 * captureCompletesBeat for whatever is already unioned into the row and
 * advances the beat with zero user action — and the newly-active NEXT beat
 * finds its own field already unioned in too, so the same stale climb (still
 * ahead of the new baseline) advances it again on the next render, chaining
 * through every beat that has any accumulated data. This is exactly the
 * round-2 cascade (which survived B55, per the wave-2 status notes: "idle-
 * cascade survives freshness gate").
 *
 * Fix: the leading-edge climb effect now also requires `hasFreshServerWrite`,
 * closing the gap symmetrically with the other two advances.
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

describe('W2-A: the leading-edge climb must not advance on a stale current_step climb', () => {
  it('holds at category forever when a fresh category value is present but the row was never written to while category was active (the cascade shape)', async () => {
    // Entered category fresh at its own step (3), no category chosen yet.
    serverState = rowAt(
      3,
      { nickname: 'Mintesnot', age: 29, gender: 'Female', path: 'simple' },
      'simple',
      T0,
    );
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');

    // The row now carries a category value AND a step climb past 3 — but
    // `updated_at` is STILL T0 (no genuine write since category became
    // active; this is the stale-union shape a queued/out-of-order write or a
    // carried-over account state produces).
    serverState = rowAt(
      4,
      { nickname: 'Mintesnot', age: 29, gender: 'Female', category: 'Health & Fitness' },
      'simple',
      T0,
    );
    render('category');
    await flush();
    // MUST hold — a climb with no fresh write proves nothing was genuinely
    // saved while this beat was being watched.
    expect(latest!.currentNode?.id).toBe('category');
    expect(persistence.saveStep).not.toHaveBeenCalled();
  });

  it('legitimate case: a genuinely fresh write (updated_at climbs alongside current_step) still advances category normally', async () => {
    serverState = rowAt(3, { nickname: 'Mintesnot', age: 29, gender: 'Female' }, 'simple', T0);
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');

    // A real save happens while category is active: current_step climbs to 4
    // AND updated_at climbs past the entry baseline — this is what a genuine
    // Vapi/Direct-LLM submit_category looks like from the client's view.
    serverState = rowAt(
      4,
      { nickname: 'Mintesnot', age: 29, gender: 'Female', category: 'Health & Fitness' },
      'simple',
      T1,
    );
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('goals');
  });

  it('non-regression: the full cascade chain (category -> goals -> habit-select -> habit-schedule) still requires a fresh write at EACH beat, not just the first', async () => {
    // category advances on a fresh write...
    serverState = rowAt(3, { nickname: 'Fable', age: 30, gender: 'Male' }, 'simple', T0);
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');

    serverState = rowAt(
      4,
      { nickname: 'Fable', age: 30, gender: 'Male', category: 'Sleep better' },
      'simple',
      T1,
    );
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('goals');

    // ...but goals must NOT auto-advance off the SAME stale row (no new write
    // since goals became active) even though goals' own baseline (step 4) has
    // already been climbed past by the category save above.
    render('goals');
    await flush();
    expect(latest!.currentNode?.id).toBe('goals');
    expect(persistence.saveStep).not.toHaveBeenCalled();
  });

  it('critical non-regression: a beat entered with NO server row yet (fresh account, nothing loaded) still advances on the first real save', async () => {
    serverState = null;
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');

    // First row observed while category is active: no category yet. This
    // becomes the entry baseline (undefined -> any row now is "fresh").
    serverState = rowAt(3, { nickname: 'Fable' }, 'simple', T0);
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('category');

    // The real save lands while category is active.
    serverState = rowAt(4, { nickname: 'Fable', category: 'Sleep better' }, 'simple', T1);
    render('category');
    await flush();
    expect(latest!.currentNode?.id).toBe('goals');
  });
});

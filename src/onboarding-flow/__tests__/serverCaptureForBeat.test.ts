import { describe, expect, it } from 'vitest';
import type { OnboardingStepData } from '@gg/shared/types';
import flowJson from '../flows/onboarding-beginner-v1.generated.json';
import type { FlowDocument } from '../types';
import { serverCaptureForBeat } from '../useFlowOrchestrator';

// Structural lock against the silent empty-replay class: every beat whose tool
// persists fields must have a serverCaptureForBeat case that pulls SOMETHING back
// out of the server data. A missing case falls through to default → empty capture
// → the answer is silently dropped from the past-beat summary on a voice advance.
const flow = flowJson as unknown as FlowDocument;

// Every OnboardingStepData field any capture case could read, all populated.
const FULL_DATA = {
  age: 30,
  gender: 'Other',
  path: 'simple',
  category: 'Health & Fitness',
  goals: ['Move daily'],
  habitConfigs: { Walking: { days: [1], time: '08:00', reminder: true, schedule: 'Every day' } },
  reflectionConfig: { mode: 'prompts', prompts: ['What went well?'] },
  brainDumpText: 'a free-text brain dump',
  morningCheckin: { time: '07:30', days: [1], reminder: true },
  weeklyConfig: { day: 0 },
  // state-check: record_checkin (voice) writes stateCheck, the card tap writes
  // checkin — serverCaptureForBeat replays whichever exists, no fabricated proxy.
  stateCheck: { sleep: 3, mood: 4 },
} as unknown as OnboardingStepData;

const persistBeats = flow.nodes.filter((n) => (n.tool?.persistsFields?.length ?? 0) > 0);

describe('serverCaptureForBeat parity with persistsFields', () => {
  it('the flow has persist-bearing beats to check', () => {
    expect(persistBeats.length).toBeGreaterThan(0);
  });

  for (const node of persistBeats) {
    it(`${node.screenId} (${node.componentType}) replays a non-empty capture`, () => {
      const cap = serverCaptureForBeat(node, FULL_DATA);
      const nonEmpty = Object.keys(cap.data).length > 0 || cap.path != null;
      expect(
        nonEmpty,
        `${node.componentType} has no serverCaptureForBeat case → voice advance drops its answer`,
      ).toBe(true);
    });
  }
});

describe('morning refusal skip marker (B58 follow-up)', () => {
  const node = flow.nodes.find((n) => n.componentType === 'morning-checkin-setup')!;

  it('replays morningCheckinSkipped when no config exists, so the capture completes the beat', () => {
    // An explicit refusal persists the marker instead of a config. The capture
    // must carry SOMETHING or captureCompletesBeat blocks the advance and the
    // user is stuck on the beat they just declined.
    const cap = serverCaptureForBeat(node, {
      ...FULL_DATA,
      morningCheckin: undefined,
      morningCheckinSkipped: true,
    } as unknown as OnboardingStepData);
    expect(cap.data).toEqual({ morningCheckinSkipped: true });
  });

  it('a real config wins over a stale marker (user refused, then changed their mind)', () => {
    const cap = serverCaptureForBeat(node, {
      ...FULL_DATA,
      morningCheckinSkipped: true,
    } as unknown as OnboardingStepData);
    expect(cap.data.morningCheckin).toEqual(
      (FULL_DATA as { morningCheckin: unknown }).morningCheckin,
    );
    expect(cap.data.morningCheckinSkipped).toBeUndefined();
  });
});

describe('advanced-capture replay carries the skimmer cards (B26)', () => {
  it('copies brainDumpHabits alongside brainDumpText', () => {
    const node = flow.nodes.find((n) => n.componentType === 'advanced-capture')!;
    const cap = serverCaptureForBeat(node, {
      ...FULL_DATA,
      brainDumpHabits: [{ name: 'read before bed', days: [1, 3], polarity: 'positive' }],
    } as unknown as OnboardingStepData);
    expect(cap.data.brainDumpText).toBe('a free-text brain dump');
    expect(cap.data.brainDumpHabits).toEqual([
      { name: 'read before bed', days: [1, 3], polarity: 'positive' },
    ]);
  });
});

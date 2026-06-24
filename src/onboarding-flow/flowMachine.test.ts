import { describe, expect, it } from 'vitest';
import { onboardingBeginnerV1 } from './flows/onboarding-beginner-v1';
import {
  applyCapture,
  canGoBack,
  type FlowMachineState,
  goBack,
  initFlowMachine,
  resolveNextNodeId,
  validateFlow,
} from './flowMachine';
import type { BeatCapture, FlowDocument } from './types';

const flow = onboardingBeginnerV1;

/** Drive the machine through a list of captures, returning the final state. */
function run(doc: FlowDocument, captures: BeatCapture[]): FlowMachineState {
  let state = initFlowMachine(doc);
  for (const c of captures) state = applyCapture(doc, state, c);
  return state;
}

describe('flowMachine — validity', () => {
  it('the authored v1 flow has no dangling references', () => {
    expect(validateFlow(flow)).toEqual([]);
  });

  it('validateFlow reports dangling nextId', () => {
    const broken: FlowDocument = {
      ...flow,
      nodes: flow.nodes.map((n) =>
        n.id === 'profile' && n.type === 'beat' ? { ...n, nextId: 'does-not-exist' } : n,
      ),
    };
    expect(validateFlow(broken)).toContain('profile.nextId -> unknown node "does-not-exist"');
  });
});

describe('flowMachine — linear advance', () => {
  it('starts at the entry node (auth, beat 0)', () => {
    const state = initFlowMachine(flow);
    expect(state.currentNodeId).toBe('auth');
    expect(state.visited).toEqual(['auth']);
    expect(state.status).toBe('running');
  });

  it('advances auth -> profile -> path-fork', () => {
    const state = run(flow, [{ data: {} }, { data: { age: 38, gender: 'Male' } }]);
    expect(state.currentNodeId).toBe('path-fork');
    expect(state.visited).toEqual(['auth', 'profile', 'path-fork']);
  });
});

describe('flowMachine — answers held across beats (the original bug)', () => {
  it('accumulates every answer; nothing resets per beat', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: { age: 38, gender: 'Male' } }, // profile (age + gender only; name from auth)
      { data: {}, path: 'simple' }, // path-fork
      { data: { category: 'Reduce stress' } }, // category
      { data: { goals: ['Feel calmer during the day'] } }, // goals
    ]);

    // Profile answer survives four beats later.
    expect(state.answers.gender).toBe('Male');
    expect(state.answers.age).toBe(38);
    expect(state.answers.path).toBe('simple');
    expect(state.answers.category).toBe('Reduce stress');
    expect(state.answers.goals).toEqual(['Feel calmer during the day']);
    expect(state.currentNodeId).toBe('habit-select');
  });
});

describe('flowMachine — the fork', () => {
  it('routes the simple lane to the category beat', () => {
    const fork = flow.nodes.find((n) => n.id === 'path-fork')!;
    expect(resolveNextNodeId(flow, fork, { path: 'simple' })).toBe('category');
  });

  it('routes the braindump lane to the advanced beat', () => {
    const fork = flow.nodes.find((n) => n.id === 'path-fork')!;
    expect(resolveNextNodeId(flow, fork, { path: 'braindump' })).toBe('advanced-input');
  });

  it('falls back to the merge node when no lane matches', () => {
    const fork = flow.nodes.find((n) => n.id === 'path-fork')!;
    expect(resolveNextNodeId(flow, fork, {})).toBe('plan-review');
  });

  it('beginner lane rejoins at plan-review and completes', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: { age: 30, gender: 'Other' } }, // profile
      { data: {}, path: 'simple' },
      { data: { category: 'Sleep better' } },
      { data: { goals: ['Fall asleep earlier'] } },
      { data: { habitConfigs: { 'No screens after 10 PM': { days: [1], time: '21:00', reminder: true } } } },
      { data: { reflectionConfig: { time: '21:45', days: [1, 2, 3, 4, 5], reminder: true, schedule: 'Weekday' } } },
      { data: {} }, // plan-review confirm
    ]);
    expect(state.status).toBe('complete');
    expect(state.currentNodeId).toBeNull();
    expect(state.visited).not.toContain('advanced-input');
    expect(state.visited).toContain('plan-review');
  });

  it('advanced lane reaches plan-review via the brain-dump beat', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: { age: 22, gender: 'Female' } }, // profile
      { data: {}, path: 'braindump' },
      { data: { brainDumpText: 'I want to sleep earlier and stop doomscrolling' } },
    ]);
    expect(state.currentNodeId).toBe('plan-review');
    expect(state.visited).toContain('advanced-input');
    expect(state.visited).not.toContain('category');
    expect(state.answers.brainDumpText).toContain('doomscrolling');
  });
});

describe('flowMachine — back navigation', () => {
  it('goBack returns to a visited backId and trims history', () => {
    // auth -> profile -> fork -> category; category.backId = path-fork (visited).
    let state = run(flow, [
      { data: {} },
      { data: { age: 40, gender: 'Male' } },
      { data: {}, path: 'simple' },
    ]);
    expect(state.currentNodeId).toBe('category');
    expect(canGoBack(state, flow)).toBe(true);
    state = goBack(flow, state);
    expect(state.currentNodeId).toBe('path-fork');
    expect(state.visited).toEqual(['auth', 'profile', 'path-fork']);
  });

  it('cannot go back from the entry beat (backId not visited)', () => {
    const state = initFlowMachine(flow); // at profile, backId null
    expect(canGoBack(state, flow)).toBe(false);
    expect(goBack(flow, state)).toEqual(state);
  });
});

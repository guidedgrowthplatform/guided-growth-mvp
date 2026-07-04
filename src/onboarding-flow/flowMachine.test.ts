import { describe, expect, it } from 'vitest';
import {
  applyCapture,
  canGoBack,
  type FlowMachineState,
  goBack,
  initFlowMachine,
  resolveNextNodeId,
  validateFlow,
} from './flowMachine';
import { onboardingBeginnerV1 } from './flows/__fixtures__/onboarding-beginner-v1';
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

  it('advances auth -> mic -> profile -> path-fork', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: {} }, // mic permission
      { data: { age: 38, gender: 'Male' } }, // profile
    ]);
    expect(state.currentNodeId).toBe('path-fork');
    expect(state.visited).toEqual(['auth', 'mic', 'profile', 'path-fork']);
  });
});

describe('flowMachine — answers held across beats (the original bug)', () => {
  it('accumulates every answer; nothing resets per beat', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: {} }, // mic permission
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

  it('an unanswered fork is UNRESOLVABLE by default (no merge fallthrough)', () => {
    const fork = flow.nodes.find((n) => n.id === 'path-fork')!;
    expect(resolveNextNodeId(flow, fork, {})).toBeUndefined();
  });

  it('branchFallthrough (QA walks only) routes an unanswered fork to the merge', () => {
    const fork = flow.nodes.find((n) => n.id === 'path-fork')!;
    expect(resolveNextNodeId(flow, fork, {}, { branchFallthrough: true })).toBe('plan-review');
  });

  it('applyCapture HOLDS at an unanswered fork: empty captures never traverse it', () => {
    let state = run(flow, [
      { data: {} }, // auth
      { data: {} }, // mic permission
      { data: { age: 38, gender: 'Male' } }, // profile
    ]);
    expect(state.currentNodeId).toBe('path-fork');
    // The live jump-to-end shape: repeated empty captures at the fork (a stale
    // current_step climb replayed with no path) must not move the machine.
    for (let i = 0; i < 3; i++) state = applyCapture(flow, state, { data: {} });
    expect(state.currentNodeId).toBe('path-fork');
    expect(state.status).toBe('running');
    // Answers from a partial capture still merge while holding.
    state = applyCapture(flow, state, { data: { age: 39 } });
    expect(state.currentNodeId).toBe('path-fork');
    expect(state.answers.age).toBe(39);
    // The real answer then enters the chosen lane.
    state = applyCapture(flow, state, { data: {}, path: 'simple' });
    expect(state.currentNodeId).toBe('category');
  });

  it('beginner lane runs the full spine and completes at into-app', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: {} }, // mic permission
      { data: { age: 30, gender: 'Other' } }, // profile
      { data: {}, path: 'simple' },
      { data: { category: 'Sleep better' } }, // category
      { data: { goals: ['Fall asleep earlier'] } }, // goals
      {
        data: {
          habitConfigs: { 'No screens after 10 PM': { days: [1], time: '21:00', reminder: true } },
        },
      }, // habit-select
      {
        data: {
          habitConfigs: {
            'No screens after 10 PM': {
              days: [1, 2, 3, 4, 5],
              time: '21:00',
              reminder: true,
              schedule: 'Weekday',
            },
          },
        },
      }, // habit-schedule
      { data: {} }, // plan-review
      {
        data: {
          morningCheckin: {
            time: '08:00',
            days: [0, 1, 2, 3, 4, 5, 6],
            reminder: true,
            schedule: 'Every day',
          },
        },
      }, // morning-checkin-setup
      {
        data: {
          reflectionConfig: {
            time: '21:45',
            days: [1, 2, 3, 4, 5],
            reminder: true,
            schedule: 'Weekday',
          },
        },
      }, // reflection-setup
      { data: {} }, // into-app (terminal)
    ]);
    expect(state.status).toBe('complete');
    expect(state.currentNodeId).toBeNull();
    expect(state.visited).not.toContain('advanced-input');
    expect(state.visited).toContain('plan-review');
    expect(state.visited).toContain('morning-checkin-setup');
    expect(state.visited).toContain('reflection-setup');
    expect(state.visited).toContain('into-app');
  });

  it('advanced lane reaches plan-review via the brain-dump beat', () => {
    const state = run(flow, [
      { data: {} }, // auth
      { data: {} }, // mic permission
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
    // auth -> mic -> profile -> fork -> category; category.backId = path-fork (visited).
    let state = run(flow, [
      { data: {} }, // auth
      { data: {} }, // mic permission
      { data: { age: 40, gender: 'Male' } }, // profile
      { data: {}, path: 'simple' }, // path-fork
    ]);
    expect(state.currentNodeId).toBe('category');
    expect(canGoBack(state, flow)).toBe(true);
    state = goBack(flow, state);
    expect(state.currentNodeId).toBe('path-fork');
    expect(state.visited).toEqual(['auth', 'mic', 'profile', 'path-fork']);
  });

  it('cannot go back from the entry beat (backId not visited)', () => {
    const state = initFlowMachine(flow); // at auth (entry), backId null
    expect(canGoBack(state, flow)).toBe(false);
    expect(goBack(flow, state)).toEqual(state);
  });
});

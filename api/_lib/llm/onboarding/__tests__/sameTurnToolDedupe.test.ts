import { describe, expect, it } from 'vitest';
import {
  DEDUPE_EXCLUDED_TOOLS,
  SameTurnToolDedupe,
  toolCallDedupeKey,
} from '../sameTurnToolDedupe.js';

// W2-E: round-2 QA found the model firing the SAME tool with the SAME args
// twice in one turn (R20/R21/R26). This guard skips re-execution of an exact
// repeat and hands the model the first call's real result.
describe('SameTurnToolDedupe', () => {
  it('does not skip the first call', () => {
    const dedupe = new SameTurnToolDedupe();
    expect(dedupe.shouldSkip('add_habit', { name: 'No screens in bed' })).toBe(false);
  });

  it('skips an exact repeat (name + args) after the first is recorded', () => {
    const dedupe = new SameTurnToolDedupe();
    const args = { name: 'No screens in bed' };
    expect(dedupe.shouldSkip('add_habit', args)).toBe(false);
    dedupe.record('add_habit', args, { ok: false, error: 'handler_error' });
    expect(dedupe.shouldSkip('add_habit', { name: 'No screens in bed' })).toBe(true);
    expect(dedupe.priorResult('add_habit', { name: 'No screens in bed' })).toEqual({
      ok: false,
      error: 'handler_error',
    });
  });

  it('R21 shape: add_habit fires twice for an identical existing preset name', () => {
    // skipper trail: add_habit("No screens in bed") fails, model retries with
    // the exact same args. Second call should be recognized as a duplicate.
    const dedupe = new SameTurnToolDedupe();
    const args = { name: 'No screens in bed', days: [0, 1, 2, 3, 4, 5, 6], time: '22:00' };
    expect(dedupe.shouldSkip('add_habit', args)).toBe(false);
    dedupe.record('add_habit', args, { ok: false, error: 'handler_error' });
    expect(dedupe.shouldSkip('add_habit', { ...args })).toBe(true);
  });

  it('R26 shape: does NOT dedupe two submit_goals calls with different values', () => {
    const dedupe = new SameTurnToolDedupe();
    const first = { goal: 'sleep_better' };
    const second = { goal: 'reduce_stress' };
    expect(dedupe.shouldSkip('submit_goals', first)).toBe(false);
    dedupe.record('submit_goals', first, { ok: true });
    expect(dedupe.shouldSkip('submit_goals', second)).toBe(false);
  });

  it('the two-call add_habit configure pattern (different args each call) is never treated as a duplicate', () => {
    // Call 1: name-only capture. Call 2: schedule-only edit — different args,
    // must both execute normally.
    const dedupe = new SameTurnToolDedupe();
    const call1 = { name: 'Walk' };
    const call2 = { name: 'Walk', days: [1, 3, 5], time: '07:00' };
    expect(dedupe.shouldSkip('add_habit', call1)).toBe(false);
    dedupe.record('add_habit', call1, { ok: true });
    expect(dedupe.shouldSkip('add_habit', call2)).toBe(false);
  });

  it('key order in args does not cause a false negative', () => {
    const dedupe = new SameTurnToolDedupe();
    dedupe.record('add_habit', { name: 'Walk', time: '07:00', days: [1, 3, 5] }, { ok: true });
    expect(dedupe.shouldSkip('add_habit', { days: [1, 3, 5], time: '07:00', name: 'Walk' })).toBe(
      true,
    );
  });

  it('never dedupes submit_brain_dump (W2-D owns same-turn merging for it)', () => {
    const dedupe = new SameTurnToolDedupe();
    const args = { brain_dump_raw: 'Walking. Reading.' };
    dedupe.record('submit_brain_dump', args, { ok: true });
    expect(dedupe.shouldSkip('submit_brain_dump', { ...args })).toBe(false);
    expect(DEDUPE_EXCLUDED_TOOLS.has('submit_brain_dump')).toBe(true);
  });

  it('different tool names with identical args are not confused for each other', () => {
    const dedupe = new SameTurnToolDedupe();
    const args = { name: 'Walk' };
    dedupe.record('add_habit', args, { ok: true });
    expect(dedupe.shouldSkip('update_habit', args)).toBe(false);
  });
});

describe('toolCallDedupeKey', () => {
  it('is stable regardless of key insertion order', () => {
    const a = toolCallDedupeKey('add_habit', { name: 'Walk', time: '07:00' });
    const b = toolCallDedupeKey('add_habit', { time: '07:00', name: 'Walk' });
    expect(a).toBe(b);
  });

  it('distinguishes different tool names with the same args', () => {
    const a = toolCallDedupeKey('add_habit', { name: 'Walk' });
    const b = toolCallDedupeKey('update_habit', { name: 'Walk' });
    expect(a).not.toBe(b);
  });

  it('distinguishes different args for the same tool', () => {
    const a = toolCallDedupeKey('add_habit', { name: 'Walk' });
    const b = toolCallDedupeKey('add_habit', { name: 'Run' });
    expect(a).not.toBe(b);
  });
});

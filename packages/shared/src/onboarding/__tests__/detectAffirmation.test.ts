import { describe, it, expect } from 'vitest';
import { detectAffirmation } from '../detectAffirmation';

describe('detectAffirmation', () => {
  it('single affirmed', () => {
    for (const s of ['yes', 'Yes!', 'yep', 'looks good', 'move on', 'ready', '  OK. ']) {
      expect(detectAffirmation(s, 'single').affirmed, s).toBe(true);
    }
  });

  it('multi done-signals affirmed with reason done_signal', () => {
    for (const s of ['done', "that's all", 'move on', 'all set', "I'm finished"]) {
      const r = detectAffirmation(s, 'multi');
      expect(r.affirmed, s).toBe(true);
      expect(r.reason, s).toBe('done_signal');
    }
  });

  it('multi bare tokens not affirmed (reason none)', () => {
    for (const s of ['yes', 'ok', 'sure', 'good']) {
      const r = detectAffirmation(s, 'multi');
      expect(r.affirmed, s).toBe(false);
      expect(r.reason, s).toBe('none');
    }
  });

  it('additive veto on multi', () => {
    for (const s of ['yes add a run too', 'also meditation', 'one more', 'plus journaling']) {
      const r = detectAffirmation(s, 'multi');
      expect(r.affirmed, s).toBe(false);
      expect(r.reason, s).toBe('additive');
    }
  });

  it('additive veto on single', () => {
    const r = detectAffirmation('yes add a run', 'single');
    expect(r.affirmed).toBe(false);
    expect(r.reason).toBe('additive');
  });

  it('bare "and" + done signal is not vetoed', () => {
    for (const kind of ['single', 'multi'] as const) {
      const r = detectAffirmation('and done', kind);
      expect(r.affirmed, kind).toBe(true);
      expect(r.reason, kind).toBe('done_signal');
    }
    expect(detectAffirmation('ready and finished', 'multi').reason).toBe('done_signal');
  });

  it('single done-signal affirmed with reason done_signal', () => {
    const r = detectAffirmation('finished', 'single');
    expect(r.affirmed).toBe(true);
    expect(r.reason).toBe('done_signal');
  });

  it('revisit vocab affirmed in single mode', () => {
    for (const s of ['keep going', 'keep it', 'all good', 'go on', "that's right"]) {
      expect(detectAffirmation(s, 'single').affirmed, s).toBe(true);
    }
  });

  it('bare "keep" inside a phrase does not affirm', () => {
    expect(detectAffirmation('keep them all', 'single').affirmed).toBe(false);
  });

  it('edit/switch veto as negation', () => {
    for (const s of ['edit the goal', 'switch it to walking']) {
      expect(detectAffirmation(s, 'single').reason, s).toBe('negation');
    }
  });

  it('negation veto', () => {
    for (const s of [
      'no',
      'not yet',
      "I'm not done",
      'wait',
      'yes but the goal is wrong',
      'change it',
      'go back',
      'actually no',
    ]) {
      const r = detectAffirmation(s, 'single');
      expect(r.affirmed, s).toBe(false);
      expect(r.reason, s).toBe('negation');
    }
  });

  it('negation veto on multi', () => {
    const r = detectAffirmation('no not those', 'multi');
    expect(r.affirmed).toBe(false);
    expect(r.reason).toBe('negation');
  });

  it('boundary: must not match substrings', () => {
    for (const s of ['yesterday I ran', 'I know', 'is that right?', "I'm not good at running"]) {
      expect(detectAffirmation(s, 'single').affirmed, s).toBe(false);
    }
  });

  it('empty', () => {
    expect(detectAffirmation('', 'single').reason).toBe('empty');
    expect(detectAffirmation('   ', 'multi').reason).toBe('empty');
  });
});

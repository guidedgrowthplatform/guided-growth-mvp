import { describe, it, expect } from 'vitest';
import { extractGhostCapture, type SkimVocab } from './liveSkimmer';

const VOCAB: SkimVocab = {
  categories: [
    { value: 'sleep', label: 'Sleep better', synonyms: ['sleep', 'rest'] },
    { value: 'move', label: 'Move more', synonyms: ['exercise', 'fitness', 'workout'] },
    { value: 'focus', label: 'Improve focus', synonyms: ['focus', 'concentration'] },
  ],
  goals: [
    { value: 'walk', label: 'Walk daily', synonyms: ['walking', 'walk'] },
    { value: 'gym', label: 'Go to the gym', synonyms: ['gym', 'lift'] },
    { value: 'stretch', label: 'Stretch', synonyms: ['stretching'] },
  ],
  habits: [
    { name: 'Meditate', synonyms: ['meditation', 'meditating'] },
    { name: 'Drink water', synonyms: ['water', 'hydrate'] },
    { name: 'Run', synonyms: ['running', 'jog', 'jogging'] },
  ],
};

describe('extractGhostCapture — profile-input', () => {
  it('extracts age from "I\'m 34"', () => {
    expect(extractGhostCapture('profile-input', "I'm 34 and ready")).toEqual({ data: { age: 34 } });
  });

  it('extracts age from "34 years old"', () => {
    expect(extractGhostCapture('profile-input', 'I am 34 years old')).toEqual({
      data: { age: 34 },
    });
  });

  it('extracts gender', () => {
    expect(extractGhostCapture('profile-input', "I'm a guy")).toEqual({ data: { gender: 'Male' } });
    expect(extractGhostCapture('profile-input', 'I am a woman')).toEqual({
      data: { gender: 'Female' },
    });
    expect(extractGhostCapture('profile-input', 'non-binary')).toEqual({
      data: { gender: 'Other' },
    });
  });

  it('extracts age and gender together', () => {
    expect(extractGhostCapture('profile-input', "I'm 28, female")).toEqual({
      data: { age: 28, gender: 'Female' },
    });
  });

  it('rejects out-of-range and ambiguous numbers (conservative)', () => {
    expect(extractGhostCapture('profile-input', 'I wake up at 6')).toBeNull();
    expect(extractGhostCapture('profile-input', "I'm 200")).toBeNull();
    expect(extractGhostCapture('profile-input', 'see you in 5 minutes')).toBeNull();
  });

  it('returns null when nothing is recognized', () => {
    expect(extractGhostCapture('profile-input', 'hello there')).toBeNull();
  });
});

describe('extractGhostCapture — path-selection', () => {
  it('detects braindump intent', () => {
    expect(extractGhostCapture('path-selection', 'let me just tell you everything')).toEqual({
      data: {},
      path: 'braindump',
    });
    expect(extractGhostCapture('path-selection', 'I already track my habits')).toEqual({
      data: {},
      path: 'braindump',
    });
  });

  it('detects simple/guided intent', () => {
    expect(extractGhostCapture('path-selection', 'guide me step by step')).toEqual({
      data: {},
      path: 'simple',
    });
    expect(extractGhostCapture('path-selection', "I'm new to this")).toEqual({
      data: {},
      path: 'simple',
    });
  });

  it('returns null when unclear', () => {
    expect(extractGhostCapture('path-selection', 'hmm not sure')).toBeNull();
  });
});

describe('extractGhostCapture — category-grid', () => {
  it('matches a category by synonym', () => {
    expect(extractGhostCapture('category-grid', 'I want to exercise more', VOCAB)).toEqual({
      data: { category: 'move' },
    });
  });

  it('matches by label', () => {
    expect(extractGhostCapture('category-grid', 'sleep better honestly', VOCAB)).toEqual({
      data: { category: 'sleep' },
    });
  });

  it('returns null with no vocab match', () => {
    expect(extractGhostCapture('category-grid', 'something else', VOCAB)).toBeNull();
    expect(extractGhostCapture('category-grid', 'exercise', undefined)).toBeNull();
  });
});

describe('extractGhostCapture — goals-list', () => {
  it('matches multiple goals, capped at 2', () => {
    const r = extractGhostCapture('goals-list', 'walking and gym and stretching', VOCAB);
    expect(r?.data.goals).toHaveLength(2);
    expect(r?.data.goals).toEqual(['walk', 'gym']);
  });

  it('matches a single goal', () => {
    expect(extractGhostCapture('goals-list', 'I want to stretch', VOCAB)).toEqual({
      data: { goals: ['stretch'] },
    });
  });

  it('returns null with no match', () => {
    expect(extractGhostCapture('goals-list', 'nothing relevant', VOCAB)).toBeNull();
  });
});

describe('extractGhostCapture — habit-picker (the headline)', () => {
  it('recognizes offered habits by name and synonym', () => {
    const r = extractGhostCapture('habit-picker', 'I want to meditate and drink more water', VOCAB);
    expect(new Set(r?.habitNames)).toEqual(new Set(['Meditate', 'Drink water']));
  });

  it('recognizes running via synonym', () => {
    const r = extractGhostCapture('habit-picker', 'definitely some running', VOCAB);
    expect(r?.habitNames).toContain('Run');
  });

  it('recognizes a free-form habit intent without vocab', () => {
    const r = extractGhostCapture('habit-picker', 'I want to read every night');
    expect(r?.habitNames?.some((n) => n.includes('read'))).toBe(true);
  });

  it('returns null when no habit is mentioned', () => {
    expect(extractGhostCapture('habit-picker', 'okay sounds good', VOCAB)).toBeNull();
  });
});

describe('extractGhostCapture — beats with nothing to skim', () => {
  it('returns null for reflection-card, auth, plan-cards, coach-bubble', () => {
    expect(extractGhostCapture('reflection-card', 'at 8pm on weekdays', VOCAB)).toBeNull();
    expect(extractGhostCapture('auth', 'sign me in', VOCAB)).toBeNull();
    expect(extractGhostCapture('plan-cards', 'looks good', VOCAB)).toBeNull();
    expect(extractGhostCapture('coach-bubble', 'anything', VOCAB)).toBeNull();
  });

  it('returns null on empty transcript', () => {
    expect(extractGhostCapture('profile-input', '   ')).toBeNull();
  });
});

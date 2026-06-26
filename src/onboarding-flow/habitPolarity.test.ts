import { describe, it, expect } from 'vitest';
import { inferHabitPolarity } from './habitPolarity';

describe('inferHabitPolarity — clear negative (break/avoid)', () => {
  const negatives = [
    'No caffeine after 2 PM',
    'No screens after 10 PM',
    'No snooze',
    'Stop watching news',
    'Reduce overeating',
    'Cut sugar',
    'Limit screen time',
    'Quit vaping',
    'Avoid late-night snacking',
    'Drink less coffee', // do-verb + reduce word -> negative wins
  ];
  it.each(negatives)('classifies "%s" as negative', (name) => {
    const r = inferHabitPolarity(name);
    expect(r.polarity).toBe('negative');
    expect(r.confident).toBe(true);
  });
});

describe('inferHabitPolarity — clear positive (do)', () => {
  const positives = [
    'Walk more',
    'Meditate',
    'Drink water',
    'Read every night',
    'Go to the gym',
    'Stretch in the morning',
    'Journal daily',
    'Floss',
  ];
  it.each(positives)('classifies "%s" as positive', (name) => {
    const r = inferHabitPolarity(name);
    expect(r.polarity).toBe('positive');
    expect(r.confident).toBe(true);
  });
});

describe('inferHabitPolarity — unclear (must confirm with the user)', () => {
  const unclear = ['Phone stays outside bedroom', 'Screen time', 'News', 'Caffeine', 'Bedroom'];
  it.each(unclear)('flags "%s" as unclear', (name) => {
    const r = inferHabitPolarity(name);
    expect(r.polarity).toBeNull();
    expect(r.confident).toBe(false);
  });

  it('does not false-match "not" inside a word like notice', () => {
    // "Notice my breathing" has no negation; "breath" makes it positive.
    expect(inferHabitPolarity('Notice my breathing').polarity).toBe('positive');
  });

  it('returns unclear on empty input', () => {
    expect(inferHabitPolarity('   ').polarity).toBeNull();
  });
});

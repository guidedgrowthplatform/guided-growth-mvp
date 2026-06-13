import { describe, expect, it } from 'vitest';
import { sanitizeCoachText } from '../sanitizeCoachText';

describe('sanitizeCoachText', () => {
  it('replaces em and en dashes with a comma', () => {
    expect(sanitizeCoachText('First — what should I call you?')).toBe(
      'First, what should I call you?',
    );
    expect(sanitizeCoachText('Take a look – does it look right?')).toBe(
      'Take a look, does it look right?',
    );
  });

  it('replaces a spaced hyphen used as a dash', () => {
    expect(sanitizeCoachText('So - what feels worth improving?')).toBe(
      'So, what feels worth improving?',
    );
  });

  it('keeps ordinary hyphenated words', () => {
    expect(sanitizeCoachText('Set up an evening check-in, free-write style.')).toBe(
      'Set up an evening check-in, free-write style.',
    );
  });

  it('strips a leading dash and collapses doubles', () => {
    expect(sanitizeCoachText('— did I say that right?')).toBe('did I say that right?');
  });

  it('leaves clean text unchanged', () => {
    expect(sanitizeCoachText('What should I call you?')).toBe('What should I call you?');
  });

  it('does not mangle numeric ranges', () => {
    expect(sanitizeCoachText('Aim for 5 - 10 reps.')).toBe('Aim for 5 - 10 reps.');
  });

  it('preserves paragraph breaks', () => {
    expect(sanitizeCoachText('Line one.\n\nLine two.')).toBe('Line one.\n\nLine two.');
  });

  it('does not leave double punctuation when a dash follows a sentence end', () => {
    expect(sanitizeCoachText('Nice work. — what is next?')).toBe('Nice work. what is next?');
  });

  it('returns empty for a pure-dash string', () => {
    expect(sanitizeCoachText('—')).toBe('');
  });
});

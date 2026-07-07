import { describe, expect, it } from 'vitest';
import { fixedStreamAppend, fixSentenceJoinSpacing, joinSentences } from '../sentenceJoinSpacing';

describe('joinSentences', () => {
  it('inserts one space when the first part ends in a period', () => {
    expect(joinSentences('Your habit is set for weekdays.', "Now, let's set your time.")).toBe(
      "Your habit is set for weekdays. Now, let's set your time.",
    );
  });

  it('inserts one space when the first part ends in an exclamation mark', () => {
    expect(joinSentences('We are almost there!', "Now, let's set up your habits.")).toBe(
      "We are almost there! Now, let's set up your habits.",
    );
  });

  it('inserts one space when the first part ends in a question mark', () => {
    expect(joinSentences('Does that work?', 'Now, pick a time.')).toBe(
      'Does that work? Now, pick a time.',
    );
  });

  it('collapses to exactly one space when the first part already has a trailing space', () => {
    expect(joinSentences('Set for Sunday. ', "Now, let's talk about your goals")).toBe(
      "Set for Sunday. Now, let's talk about your goals",
    );
  });

  it('still inserts a space with no terminal punctuation at all', () => {
    expect(joinSentences('word', 'Now continues')).toBe('word Now continues');
  });

  it('returns the other side unchanged when one half is empty', () => {
    expect(joinSentences('', 'Now continues')).toBe('Now continues');
    expect(joinSentences('word', '')).toBe('word');
  });
});

describe('fixSentenceJoinSpacing', () => {
  it('fixes the exact repro strings seen in QA (period join)', () => {
    expect(fixSentenceJoinSpacing("for weekdays.Now, let's set...")).toBe(
      "for weekdays. Now, let's set...",
    );
    expect(fixSentenceJoinSpacing("for Sunday.Now, let's talk about your goals")).toBe(
      "for Sunday. Now, let's talk about your goals",
    );
  });

  it('fixes the exact repro string seen in QA (exclamation join)', () => {
    expect(fixSentenceJoinSpacing("there!Now, let's set up your habits.")).toBe(
      "there! Now, let's set up your habits.",
    );
  });

  it('fixes a question-mark join', () => {
    expect(fixSentenceJoinSpacing('Does that work?Now, pick a time.')).toBe(
      'Does that work? Now, pick a time.',
    );
  });

  it('leaves text with an existing trailing space unchanged', () => {
    expect(fixSentenceJoinSpacing("Set for Sunday. Now, let's talk about your goals")).toBe(
      "Set for Sunday. Now, let's talk about your goals",
    );
  });

  it('does not add a space when there is no terminal punctuation at the boundary', () => {
    expect(fixSentenceJoinSpacing('wordNow continues')).toBe('wordNow continues');
  });

  it('does not touch a decimal number', () => {
    expect(fixSentenceJoinSpacing('The price is 3.5 dollars.')).toBe('The price is 3.5 dollars.');
  });

  it('does not touch an abbreviation like Dr.', () => {
    expect(fixSentenceJoinSpacing('Dr. Smith arrived. Then left.')).toBe(
      'Dr. Smith arrived. Then left.',
    );
  });

  it('does not split an initialism (two-word-char guard)', () => {
    expect(fixSentenceJoinSpacing('Made in the U.S.A. today.')).toBe('Made in the U.S.A. today.');
    expect(fixSentenceJoinSpacing('at 9 p.m. tonight')).toBe('at 9 p.m. tonight');
  });

  it('returns empty/falsy input unchanged', () => {
    expect(fixSentenceJoinSpacing('')).toBe('');
  });
});

describe('fixedStreamAppend', () => {
  it('inserts a space when the seam splits exactly at the junction', () => {
    const prior = 'Your habit is set for weekdays.';
    expect(fixedStreamAppend(prior, "Now, let's set your time.")).toBe(
      " Now, let's set your time.",
    );
  });

  it('inserts a space when the terminator arrives at the start of the incoming delta', () => {
    const prior = 'Your habit is set for weekdays';
    expect(fixedStreamAppend(prior, '.Now, we continue')).toBe('. Now, we continue');
  });

  it('repairs a seam fully inside one delta', () => {
    expect(fixedStreamAppend('some prior text ', "ends here.Now, let's go")).toBe(
      "ends here. Now, let's go",
    );
  });

  it('does not insert for a mid-word split across deltas', () => {
    expect(fixedStreamAppend('for wee', 'kdays only')).toBe('kdays only');
  });

  it('does not insert for a lowercase continuation after a terminator', () => {
    expect(fixedStreamAppend('sentence ends.', 'com continues')).toBe('com continues');
  });

  it('does not double a space when the seam already has one', () => {
    expect(fixedStreamAppend('sentence ends. ', 'Now more')).toBe('Now more');
    expect(fixedStreamAppend('sentence ends.', ' Now more')).toBe(' Now more');
  });

  it('handles empty prior and empty incoming', () => {
    expect(fixedStreamAppend('', 'Hello.')).toBe('Hello.');
    expect(fixedStreamAppend('prior.', '')).toBe('');
  });
});

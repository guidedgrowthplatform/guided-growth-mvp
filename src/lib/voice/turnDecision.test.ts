import { describe, expect, it } from 'vitest';
import { isSemanticEndOfTurn, resolveTurnPauseMs } from './turnDecision';

describe('isSemanticEndOfTurn', () => {
  it('flags trailing conjunctions / articles / infinitives as incomplete', () => {
    for (const t of [
      'I want to talk about my goals and',
      'I skipped it because',
      'tell me about the',
      'I need to',
      'we should go into',
      'that reminds me of my', // possessive awaiting a noun
    ]) {
      expect(isSemanticEndOfTurn(t)).toBe('incomplete');
    }
  });

  it('flags a trailing comma as incomplete', () => {
    expect(isSemanticEndOfTurn('I did the thing,')).toBe('incomplete');
    expect(isSemanticEndOfTurn('there are a few things,')).toBe('incomplete');
  });

  it('flags terminal punctuation as complete', () => {
    for (const t of ['I am done.', 'Let us do it!', 'Why not?', 'He said "go."']) {
      expect(isSemanticEndOfTurn(t)).toBe('complete');
    }
  });

  it('treats a short standalone affirmation as complete', () => {
    for (const t of ['yes', 'okay', 'no thanks', 'sure']) {
      expect(isSemanticEndOfTurn(t)).toBe('complete');
    }
  });

  it('is unsure for an ordinary statement with no terminator', () => {
    for (const t of ['I went to the store', 'hello there friend', 'tell me a story']) {
      expect(isSemanticEndOfTurn(t)).toBe('unsure');
    }
  });

  it('does not over-extend: a sentence ending in an ambiguous word is unsure, not incomplete', () => {
    // "well", "about", pronouns deliberately excluded to avoid false delays.
    expect(isSemanticEndOfTurn('that went really well')).toBe('unsure');
    expect(isSemanticEndOfTurn('what are you thinking about')).toBe('unsure');
    expect(isSemanticEndOfTurn('it was you')).toBe('unsure');
  });

  it('is unsure for empty/whitespace', () => {
    expect(isSemanticEndOfTurn('')).toBe('unsure');
    expect(isSemanticEndOfTurn('   ')).toBe('unsure');
  });

  it('does not let a long affirmation-word phrase count as a short answer', () => {
    // ends in "right" but it's a full clause → not the short-answer path.
    expect(isSemanticEndOfTurn('I think that the plan is right')).toBe('unsure');
  });
});

describe('resolveTurnPauseMs', () => {
  const cfg = { base: 2000, complete: 900, incomplete: 2800 };

  it('maps each verdict to its window', () => {
    expect(resolveTurnPauseMs('I am done.', cfg)).toBe(900);
    expect(resolveTurnPauseMs('I want to go and', cfg)).toBe(2800);
    expect(resolveTurnPauseMs('I went to the store', cfg)).toBe(2000);
  });
});

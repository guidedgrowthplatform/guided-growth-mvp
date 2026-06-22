import { describe, expect, it } from 'vitest';
import { flushSentenceTail, nextSentenceChunks } from '../sentenceChunks';

describe('nextSentenceChunks', () => {
  it('emits a complete sentence followed by whitespace and advances the offset', () => {
    const text = 'Let us get your routine set up today. ';
    const r = nextSentenceChunks(text, 0);
    expect(r.chunks).toEqual(['Let us get your routine set up today.']);
    expect(flushSentenceTail(text, r.nextOffset)).toBe('');
  });

  it('buffers an incomplete trailing fragment (no terminator)', () => {
    expect(nextSentenceChunks('Let us set', 0)).toEqual({ chunks: [], nextOffset: 0 });
  });

  it('does not emit a terminator at the very end with no trailing whitespace', () => {
    const r = nextSentenceChunks('All done.', 0);
    expect(r.chunks).toEqual([]);
    expect(r.nextOffset).toBe(0);
    expect(flushSentenceTail('All done.', 0)).toBe('All done.');
  });

  it('emits sentence 2 only on a later streaming call from the prior offset', () => {
    const t1 = 'First sentence here is long enough. Second';
    const r1 = nextSentenceChunks(t1, 0);
    expect(r1.chunks).toEqual(['First sentence here is long enough.']);

    const t2 = 'First sentence here is long enough. Second sentence also quite long here. ';
    const r2 = nextSentenceChunks(t2, r1.nextOffset);
    expect(r2.chunks).toEqual(['Second sentence also quite long here.']);
  });

  it('does not split a decimal/time like 9.30 PM', () => {
    const r = nextSentenceChunks('It is 9.30 PM now friend. ', 0);
    expect(r.chunks).toEqual(['It is 9.30 PM now friend.']);
  });

  it('does not split after abbreviations (Dr., e.g.)', () => {
    expect(nextSentenceChunks('Dr. Lee said hello to me today. ', 0).chunks).toEqual([
      'Dr. Lee said hello to me today.',
    ]);
    // first-chunk clause split applies; sub-minChars remainder stays buffered
    const r = nextSentenceChunks('Use mornings, e.g. before work each day. ', 0);
    expect(r.chunks).toEqual(['Use mornings,']);
    expect(flushSentenceTail('Use mornings, e.g. before work each day. ', r.nextOffset)).toBe(
      'e.g. before work each day.',
    );
  });

  it('splits the FIRST chunk at a clause boundary for low latency', () => {
    const r = nextSentenceChunks('Good morning Jonah, let us look at your habits for today. ', 0);
    expect(r.chunks[0]).toBe('Good morning Jonah,');
  });

  it('does not clause-split before FIRST_CLAUSE_MIN_CHARS', () => {
    const r = nextSentenceChunks('Hi Jonah, welcome back to your morning check-in today. ', 0);
    expect(r.chunks).toEqual(['Hi Jonah, welcome back to your morning check-in today.']);
  });

  it('does not clause-split inside numbers like 1,000', () => {
    const r = nextSentenceChunks('You walked over 1,000 steps before noon today. ', 0);
    expect(r.chunks).toEqual(['You walked over 1,000 steps before noon today.']);
  });

  it('only clause-splits the first chunk, not later ones', () => {
    const text = 'Nice work today friend. Tomorrow, we will go further with the plan. ';
    const r = nextSentenceChunks(text, 0);
    expect(r.chunks).toEqual([
      'Nice work today friend.',
      'Tomorrow, we will go further with the plan.',
    ]);
  });

  it('does not clause-split when no whitespace follows the break', () => {
    const r = nextSentenceChunks('Good morning friend,today we begin the plan here. ', 0);
    expect(r.chunks).toEqual(['Good morning friend,today we begin the plan here.']);
  });

  it('clause-splits the first chunk on a colon', () => {
    const r = nextSentenceChunks('Here is the plan: we start with one small habit today. ', 0);
    expect(r.chunks[0]).toBe('Here is the plan:');
  });

  it('clause-splits the first chunk on an em-dash', () => {
    const r = nextSentenceChunks('One thing first — we set a single habit for today. ', 0);
    expect(r.chunks[0]).toBe('One thing first —');
  });

  it('does not clause-split an em-dash range between digits', () => {
    const r = nextSentenceChunks('Aim for 5—10 minutes of focus this morning friend. ', 0);
    expect(r.chunks).toEqual(['Aim for 5—10 minutes of focus this morning friend.']);
  });

  it('does not clause-split on a later streaming call (offset past first chunk)', () => {
    const r1 = nextSentenceChunks('First sentence here is plenty long. Then', 0);
    expect(r1.chunks).toEqual(['First sentence here is plenty long.']);
    const full = 'First sentence here is plenty long. Then, more follows after that. ';
    const r2 = nextSentenceChunks(full, r1.nextOffset);
    expect(r2.chunks).toEqual(['Then, more follows after that.']);
  });

  it('treats an ellipsis as a single boundary (no empty chunks)', () => {
    const r = nextSentenceChunks('Well... I am really not sure about that one yet. ', 0);
    expect(r.chunks[0]).toBe('Well...');
    expect(r.chunks).not.toContain('');
  });

  it('merges sub-minChars sentences forward (except the first of the message)', () => {
    const r = nextSentenceChunks('Done. Sure. Let us begin the whole day together now. ', 0);
    expect(r.chunks).toEqual(['Done.', 'Sure. Let us begin the whole day together now.']);
  });

  it('emits a short FIRST sentence immediately for low latency', () => {
    const r = nextSentenceChunks('Got it. Now let us set up your plan for today. ', 0);
    expect(r.chunks[0]).toBe('Got it.');
  });
});

describe('flushSentenceTail', () => {
  it('returns the unspoken remainder past the offset', () => {
    const text = 'First done here already. Second incomplete';
    const r = nextSentenceChunks(text, 0);
    expect(flushSentenceTail(text, r.nextOffset)).toBe('Second incomplete');
  });

  it('returns empty when nothing remains', () => {
    expect(flushSentenceTail('All consumed here. ', 'All consumed here. '.length)).toBe('');
  });
});

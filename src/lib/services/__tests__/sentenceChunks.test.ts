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
    expect(nextSentenceChunks('Use mornings, e.g. before work each day. ', 0).chunks).toEqual([
      'Use mornings, e.g. before work each day.',
    ]);
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

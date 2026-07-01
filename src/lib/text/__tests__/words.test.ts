import { describe, expect, it } from 'vitest';
import { sliceWords } from '../words';

describe('sliceWords', () => {
  it('returns the first n words', () => {
    expect(sliceWords('the quick brown fox', 2)).toBe('the quick');
  });
  it('returns empty for n<=0', () => {
    expect(sliceWords('anything here', 0)).toBe('');
    expect(sliceWords('anything here', -3)).toBe('');
  });
  it('returns full text when n >= word count', () => {
    expect(sliceWords('two words', 2)).toBe('two words');
    expect(sliceWords('two words', 9)).toBe('two words');
  });
  it('preserves original whitespace/newlines up to the cut', () => {
    expect(sliceWords('a\n\nb c', 2)).toBe('a\n\nb');
  });
  it('keeps leading whitespace but still counts the first word', () => {
    expect(sliceWords('  lead word here', 1)).toBe('  lead');
  });
});

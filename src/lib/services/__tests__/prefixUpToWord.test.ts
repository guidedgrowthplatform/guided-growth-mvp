import { describe, expect, it } from 'vitest';
import { prefixUpToWord } from '../tts-service';

describe('prefixUpToWord (karaoke reveal mapping)', () => {
  const text = "I hear you—that's a lot.";

  it('reveals through the Nth spoken word', () => {
    expect(prefixUpToWord(text, 0)).toBe('I');
    expect(prefixUpToWord(text, 1)).toBe('I hear');
    expect(prefixUpToWord(text, 2)).toBe("I hear you—that's");
  });

  it('returns full text when the index exceeds the word count', () => {
    expect(prefixUpToWord(text, 99)).toBe(text);
  });

  it('handles leading whitespace without off-by-one', () => {
    expect(prefixUpToWord('  hello world', 0)).toBe('  hello');
  });
});

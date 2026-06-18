import { describe, expect, it } from 'vitest';
import { joinSpoken } from '../tts-service';

describe('joinSpoken (Cartesia spoken-form spacing)', () => {
  it('single-spaces plain words', () => {
    expect(joinSpoken(['Let’s', 'aim', 'for'])).toBe('Let’s aim for');
  });

  it('glues closing punctuation tokens with no leading space', () => {
    expect(joinSpoken(['walk', ',', 'ok', '?'])).toBe('walk, ok?');
  });

  it('glues contraction tokens', () => {
    expect(joinSpoken(['It', "'s", 'fine'])).toBe("It's fine");
  });

  // Real captured word_timestamps.words[] — contraction, em-dash, comma, quotes.
  it('reconstructs a real captured payload', () => {
    const words = ['I', 'hear', 'you', '—', 'that', "'s", 'a', 'lot', ',', 'say', '“', 'yes', '”'];
    expect(joinSpoken(words)).toBe("I hear you — that's a lot, say “yes”");
  });

  it('em-dash as a standalone token keeps surrounding spaces', () => {
    expect(joinSpoken(['wait', '—', 'no'])).toBe('wait — no');
  });
});

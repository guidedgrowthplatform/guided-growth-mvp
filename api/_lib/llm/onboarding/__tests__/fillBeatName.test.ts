import { describe, it, expect } from 'vitest';
import { fillBeatName } from '../fillBeatName.js';

describe('fillBeatName', () => {
  const opener = 'Good to meet you, {name}. Two quick things so I can tailor this to you.';

  it('substitutes the known nickname', () => {
    expect(fillBeatName(opener, 'Sam')).toBe(
      'Good to meet you, Sam. Two quick things so I can tailor this to you.',
    );
  });

  it('drops the token cleanly when nickname is unknown', () => {
    expect(fillBeatName(opener, null)).toBe(
      'Good to meet you. Two quick things so I can tailor this to you.',
    );
  });

  it('treats blank/whitespace nickname as unknown', () => {
    expect(fillBeatName(opener, '   ')).toBe(
      'Good to meet you. Two quick things so I can tailor this to you.',
    );
    expect(fillBeatName('Hi {name}!', '')).toBe('Hi!');
  });

  it('trims surrounding whitespace on the nickname', () => {
    expect(fillBeatName('Hi {name}!', '  Sam  ')).toBe('Hi Sam!');
  });

  it('passes text without the token through unchanged', () => {
    expect(fillBeatName('No token here.', null)).toBe('No token here.');
  });
});

import { describe, expect, it } from 'vitest';
import { splitCoachLines } from './BeatPlayer';

describe('splitCoachLines', () => {
  it('single line stays one entry', () => {
    expect(splitCoachLines('How are you?')).toEqual(['How are you?']);
  });

  it('blank-line-joined text splits into one entry per line', () => {
    expect(splitCoachLines('intro\n\nthe ask')).toEqual(['intro', 'the ask']);
  });

  it('trims and drops empty segments', () => {
    expect(splitCoachLines('  a  \n\n\n\n  b  \n\n')).toEqual(['a', 'b']);
  });

  it('empty string yields no bubbles', () => {
    expect(splitCoachLines('')).toEqual([]);
  });
});

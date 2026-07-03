import { describe, expect, it } from 'vitest';
import { openerTurns } from './openerTurns';

describe('openerTurns (newline = turn break)', () => {
  it('returns a single-line opener as one turn', () => {
    expect(openerTurns('Have you tracked habits before?')).toEqual([
      'Have you tracked habits before?',
    ]);
  });

  it('splits a multi-line opener into one turn per line (B5 profile shape)', () => {
    const opener =
      "Good to meet you, {name}. Two quick things so I can tailor this to you.\nHow old are you?\nAnd your gender?";
    expect(openerTurns(opener)).toEqual([
      'Good to meet you, {name}. Two quick things so I can tailor this to you.',
      'How old are you?',
      'And your gender?',
    ]);
  });

  it('drops blank lines and trims whitespace', () => {
    expect(openerTurns('  First line \n\n  \n Second line ')).toEqual([
      'First line',
      'Second line',
    ]);
  });

  it('handles null and empty openers', () => {
    expect(openerTurns(null)).toEqual([]);
    expect(openerTurns(undefined)).toEqual([]);
    expect(openerTurns('')).toEqual([]);
  });
});

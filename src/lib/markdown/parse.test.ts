import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline, safeStreamPrefix } from './parse';

describe('safeStreamPrefix', () => {
  it('keeps fully-closed markup', () => {
    expect(safeStreamPrefix('a **bold** b')).toBe('a **bold** b');
    expect(safeStreamPrefix('see [t](https://x.io)')).toBe('see [t](https://x.io)');
  });

  it('holds back an unclosed bold opener', () => {
    expect(safeStreamPrefix('1. **Declut')).toBe('1.');
    expect(safeStreamPrefix('a **bold** and **mo')).toBe('a **bold** and');
  });

  it('holds back an unclosed inline code span', () => {
    expect(safeStreamPrefix('run `np')).toBe('run');
  });

  it('holds back an incomplete link', () => {
    expect(safeStreamPrefix('see [label](htt')).toBe('see');
    expect(safeStreamPrefix('see [lab')).toBe('see');
  });
});

describe('parseInline', () => {
  it('plain text is a single text node', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('parses bold (** and __)', () => {
    expect(parseInline('a **bold** b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'bold' },
      { type: 'text', value: ' b' },
    ]);
    expect(parseInline('__x__')).toEqual([{ type: 'bold', value: 'x' }]);
  });

  it('parses italic, code and links', () => {
    expect(parseInline('*i*')).toEqual([{ type: 'italic', value: 'i' }]);
    expect(parseInline('`c`')).toEqual([{ type: 'code', value: 'c' }]);
    expect(parseInline('[t](https://x.io)')).toEqual([
      { type: 'link', value: 't', href: 'https://x.io' },
    ]);
  });

  it('prefers bold over italic for **', () => {
    expect(parseInline('**both**')).toEqual([{ type: 'bold', value: 'both' }]);
  });

  it('leaves an unclosed marker as text', () => {
    expect(parseInline('5 * 4 = 20')).toEqual([{ type: 'text', value: '5 * 4 = 20' }]);
  });
});

describe('parseBlocks', () => {
  it('treats a plain line as a paragraph', () => {
    expect(parseBlocks('just text')).toEqual([{ type: 'p', lines: ['just text'] }]);
  });

  it('groups numbered lines into an ordered list', () => {
    const blocks = parseBlocks('Goals:\n1. First\n2. Second');
    expect(blocks).toEqual([
      { type: 'p', lines: ['Goals:'] },
      { type: 'ol', items: ['First', 'Second'] },
    ]);
  });

  it('groups dash/star lines into an unordered list', () => {
    expect(parseBlocks('- a\n- b')).toEqual([{ type: 'ul', items: ['a', 'b'] }]);
    expect(parseBlocks('* a\n* b')).toEqual([{ type: 'ul', items: ['a', 'b'] }]);
  });

  it('does not treat **bold** at line start as a bullet', () => {
    expect(parseBlocks('**bold** line')).toEqual([{ type: 'p', lines: ['**bold** line'] }]);
  });

  it('splits paragraphs on blank lines', () => {
    expect(parseBlocks('one\n\ntwo')).toEqual([
      { type: 'p', lines: ['one'] },
      { type: 'p', lines: ['two'] },
    ]);
  });
});

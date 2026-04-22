import { describe, it, expect } from 'vitest';
import { getEntryPreview, htmlToPlainText } from './entryPreview';

describe('htmlToPlainText', () => {
  it('strips paragraph tags and joins lines', () => {
    expect(htmlToPlainText('<p>Hello</p><p>World</p>')).toBe('Hello World');
  });

  it('converts <br> to spaces', () => {
    expect(htmlToPlainText('Line one<br>Line two')).toBe('Line one Line two');
  });

  it('prefixes list items with a bullet', () => {
    expect(htmlToPlainText('<ul><li>One</li><li>Two</li></ul>')).toBe('• One • Two');
  });

  it('decodes common entities', () => {
    expect(htmlToPlainText('Tom &amp; Jerry &quot;hi&quot;')).toBe('Tom & Jerry "hi"');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});

describe('getEntryPreview', () => {
  it('prefers fields.body', () => {
    const preview = getEntryPreview({
      fields: { body: '<p>Body wins</p>', reflection: 'Ignored', note: 'Also ignored' },
      title: 'Title ignored',
    });
    expect(preview).toBe('Body wins');
  });

  it('falls back to fields.reflection', () => {
    const preview = getEntryPreview({
      fields: { reflection: 'Reflection text' },
      title: 'Ignored',
    });
    expect(preview).toBe('Reflection text');
  });

  it('joins first two non-empty fields when body/reflection are missing', () => {
    const preview = getEntryPreview({
      fields: { wins: 'Shipped slice 1', challenges: 'Migration anxiety', gratitude: 'Coffee' },
      title: 'Ignored',
    });
    expect(preview).toBe('Shipped slice 1 · Migration anxiety');
  });

  it('skips whitespace-only fields in the fallback', () => {
    const preview = getEntryPreview({
      fields: { wins: '   ', challenges: 'Real content', gratitude: '' },
      title: 'Ignored',
    });
    expect(preview).toBe('Real content');
  });

  it('falls back to title when no fields have content', () => {
    const preview = getEntryPreview({
      fields: {},
      title: 'Just a title',
    });
    expect(preview).toBe('Just a title');
  });

  it('returns empty string when nothing is available', () => {
    const preview = getEntryPreview({ fields: {}, title: null });
    expect(preview).toBe('');
  });
});

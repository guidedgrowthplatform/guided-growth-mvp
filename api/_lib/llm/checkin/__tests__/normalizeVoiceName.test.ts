import { describe, expect, it } from 'vitest';

const { normalizeVoiceName } = await import('../handlers/shared.js');

describe('normalizeVoiceName', () => {
  it('strips leading articles', () => {
    expect(normalizeVoiceName('the morning walk')).toBe('morning walk');
    expect(normalizeVoiceName('my guitar practice')).toBe('guitar practice');
    expect(normalizeVoiceName('an evening review')).toBe('evening review');
  });

  it('strips trailing please and habit words', () => {
    expect(normalizeVoiceName('morning walk please')).toBe('morning walk');
    expect(normalizeVoiceName('guitar practice habit')).toBe('guitar practice');
    expect(normalizeVoiceName('evening review habits')).toBe('evening review');
  });

  it('handles mixed case strip phrases', () => {
    expect(normalizeVoiceName('The Morning Walk PLEASE')).toBe('Morning Walk');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeVoiceName('   ')).toBe('');
  });

  it('leaves an already-normalized name unchanged', () => {
    expect(normalizeVoiceName('morning walk')).toBe('morning walk');
  });
});

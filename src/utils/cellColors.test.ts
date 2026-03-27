import { describe, it, expect } from 'vitest';
import type { Metric } from '@shared/types';
import { getCellColor, getCellDisplayValue } from './cellColors';

const makeMetric = (overrides: Partial<Metric> = {}): Metric => ({
  id: '1',
  user_id: 'u1',
  name: 'Test',
  input_type: 'binary',
  question: '',
  active: true,
  frequency: 'daily',
  sort_order: 0,
  target_value: null,
  target_unit: null,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('getCellColor', () => {
  it('returns empty color for null/empty value', () => {
    const color = getCellColor('', makeMetric());
    expect(color).toContain('bg-slate-100');
  });

  it('returns skip color for dash', () => {
    const color = getCellColor('-', makeMetric());
    expect(color).toContain('bg-slate-200');
  });

  it('returns green for binary yes', () => {
    const color = getCellColor('yes', makeMetric());
    expect(color).toContain('bg-emerald');
  });

  it('returns red for binary no', () => {
    const color = getCellColor('no', makeMetric());
    expect(color).toContain('bg-red');
  });

  it('returns green for positive numeric', () => {
    const color = getCellColor('5', makeMetric({ input_type: 'numeric' }));
    expect(color).toContain('bg-emerald');
  });

  it('returns red for zero numeric', () => {
    const color = getCellColor('0', makeMetric({ input_type: 'numeric' }));
    expect(color).toContain('bg-red');
  });

  it('returns light green for text with value', () => {
    const color = getCellColor('hello', makeMetric({ input_type: 'short_text' }));
    expect(color).toContain('bg-emerald');
  });
});

describe('getCellDisplayValue', () => {
  it('returns empty for null/empty', () => {
    expect(getCellDisplayValue('', makeMetric())).toBe('');
    expect(getCellDisplayValue(null, makeMetric())).toBe('');
  });

  it('returns dash for dash', () => {
    expect(getCellDisplayValue('-', makeMetric())).toBe('-');
  });

  it('returns 1/0 for binary yes/no', () => {
    expect(getCellDisplayValue('yes', makeMetric())).toBe('1');
    expect(getCellDisplayValue('no', makeMetric())).toBe('0');
  });

  it('returns raw value for numeric', () => {
    expect(getCellDisplayValue('42', makeMetric({ input_type: 'numeric' }))).toBe('42');
  });
});

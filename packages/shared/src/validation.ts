import type { MetricCreate, MetricUpdate, InputType, Frequency } from './types/index.js';

const INPUT_TYPE_VALUES: InputType[] = ['binary', 'numeric', 'short_text', 'text'];
const FREQUENCY_VALUES: Frequency[] = ['daily', 'weekdays', 'weekends', 'weekly'];

export function validateMetricCreate(data: unknown): { success: true; data: MetricCreate } | { success: false; error: string } {
  if (!data || typeof data !== 'object') return { success: false, error: 'Invalid data' };
  const d = data as Record<string, unknown>;

  if (!d.name || typeof d.name !== 'string' || d.name.trim().length === 0) {
    return { success: false, error: 'Name is required' };
  }
  if (!d.input_type || !INPUT_TYPE_VALUES.includes(d.input_type as InputType)) {
    return { success: false, error: 'Invalid input_type' };
  }
  if (d.frequency !== undefined && !FREQUENCY_VALUES.includes(d.frequency as Frequency)) {
    return { success: false, error: 'Invalid frequency' };
  }

  return {
    success: true,
    data: {
      name: (d.name as string).trim(),
      input_type: d.input_type as InputType,
      question: typeof d.question === 'string' ? d.question.trim() : '',
      frequency: (d.frequency as Frequency) || 'daily',
      active: d.active !== false,
    },
  };
}

export function validateMetricUpdate(data: unknown): { success: true; data: MetricUpdate } | { success: false; error: string } {
  if (!data || typeof data !== 'object') return { success: false, error: 'Invalid data' };
  const d = data as Record<string, unknown>;
  const result: MetricUpdate = {};

  if (d.name !== undefined) {
    if (typeof d.name !== 'string' || d.name.trim().length === 0) {
      return { success: false, error: 'Name cannot be empty' };
    }
    result.name = d.name.trim();
  }
  if (d.input_type !== undefined) {
    if (!INPUT_TYPE_VALUES.includes(d.input_type as InputType)) {
      return { success: false, error: 'Invalid input_type' };
    }
    result.input_type = d.input_type as InputType;
  }
  if (d.question !== undefined) {
    result.question = typeof d.question === 'string' ? d.question.trim() : '';
  }
  if (d.active !== undefined) {
    result.active = Boolean(d.active);
  }
  if (d.frequency !== undefined) {
    if (!FREQUENCY_VALUES.includes(d.frequency as Frequency)) {
      return { success: false, error: 'Invalid frequency' };
    }
    result.frequency = d.frequency as Frequency;
  }

  return { success: true, data: result };
}

export function validateDateString(date: unknown): date is string {
  if (typeof date !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function validateDayEntries(data: unknown): data is Record<string, string> {
  if (!data || typeof data !== 'object') return false;
  return Object.entries(data as Record<string, unknown>).every(
    ([, v]) => typeof v === 'string'
  );
}

export function validateReflectionConfig(data: unknown): data is { fields: { id: string; label: string; order: number }[]; show_affirmation: boolean } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.fields)) return false;
  if (typeof d.show_affirmation !== 'boolean') return false;
  return d.fields.every(
    (f: unknown) =>
      f && typeof f === 'object' &&
      typeof (f as Record<string, unknown>).id === 'string' &&
      typeof (f as Record<string, unknown>).label === 'string' &&
      typeof (f as Record<string, unknown>).order === 'number'
  );
}

import type { InputType, Frequency } from './types/index.js';

export const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: 'binary', label: 'Binary (Yes/No)' },
  { value: 'short_text', label: 'Short Text' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'text', label: 'Text' },
];

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly', label: 'Weekly' },
];

export const DEFAULT_REFLECTION_FIELDS = [
  { id: '1', label: 'PROUD', order: 0 },
  { id: '2', label: 'FORGIVE', order: 1 },
  { id: '3', label: 'GRATEFUL', order: 2 },
];

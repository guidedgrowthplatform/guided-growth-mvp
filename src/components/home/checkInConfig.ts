import type { CheckInDimension } from '@shared/types';

export interface CheckInOption {
  value: number;
  emoji: string;
  label: string;
  color: string;
}

export interface CheckInDimensionConfig {
  key: CheckInDimension;
  label: string;
  options: CheckInOption[];
}

export const checkInDimensions: CheckInDimensionConfig[] = [
  {
    key: 'sleep',
    label: 'Sleep Quality',
    options: [
      { value: 1, emoji: '🛏️', label: 'Poor', color: '#ef4444' },
      { value: 2, emoji: '🛏️', label: 'Fair', color: '#f97316' },
      { value: 3, emoji: '🛏️', label: 'Good', color: '#eab308' },
      { value: 4, emoji: '🛏️', label: 'Great', color: '#22c55e' },
      { value: 5, emoji: '🛏️', label: 'Deep!', color: '#3b82f6' },
    ],
  },
  {
    key: 'mood',
    label: 'Mood',
    options: [
      { value: 1, emoji: '😟', label: 'Awful', color: '#ef4444' },
      { value: 2, emoji: '😕', label: 'Bad', color: '#f97316' },
      { value: 3, emoji: '😐', label: 'Meh', color: '#eab308' },
      { value: 4, emoji: '🙂', label: 'Good', color: '#22c55e' },
      { value: 5, emoji: '😄', label: 'Awesome!', color: '#10b981' },
    ],
  },
  {
    key: 'energy',
    label: 'Energy Level',
    options: [
      { value: 1, emoji: '🔋', label: 'Drained', color: '#ef4444' },
      { value: 2, emoji: '🔋', label: 'Low', color: '#f97316' },
      { value: 3, emoji: '🔋', label: 'Medium', color: '#eab308' },
      { value: 4, emoji: '🔋', label: 'Active', color: '#22c55e' },
      { value: 5, emoji: '🔋', label: 'Charged', color: '#10b981' },
    ],
  },
  {
    key: 'stress',
    label: 'Stress Level',
    options: [
      { value: 1, emoji: '😰', label: 'Extreme', color: '#ef4444' },
      { value: 2, emoji: '😟', label: 'High', color: '#f97316' },
      { value: 3, emoji: '😐', label: 'Neutral', color: '#eab308' },
      { value: 4, emoji: '🧘', label: 'Calm', color: '#6bcb77' },
      { value: 5, emoji: '🧘', label: 'Zen', color: '#10b981' },
    ],
  },
];

import type { Frequency } from '@shared/types';
import { WEEKDAYS, WEEKEND, setsEqual } from '@/components/onboarding/constants';

export type Phase =
  | 'choose-path'
  | 'beginner-select'
  | 'beginner-confirm'
  | 'advanced-input'
  | 'advanced-results'
  | 'advanced-edit';

export interface HabitItem {
  name: string;
  days: Set<number>;
  time: string;
}

export function daysToFrequency(days: Set<number>): Frequency {
  if (days.size === 7) return 'daily';
  if (setsEqual(days, WEEKDAYS)) return 'weekdays';
  if (setsEqual(days, WEEKEND)) return 'weekends';
  if (days.size <= 2) return 'weekly';
  return 'daily';
}

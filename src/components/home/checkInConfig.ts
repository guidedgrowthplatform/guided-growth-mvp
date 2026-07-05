import type { ComponentType } from 'react';
import type { CheckInDimension } from '@gg/shared/types';
import {
  SleepPoor,
  SleepFair,
  SleepGood,
  SleepGreat,
  SleepDeep,
  MoodAwful,
  MoodBad,
  MoodMeh,
  MoodGood,
  MoodAwesome,
  EnergyDrained,
  EnergyLow,
  EnergyMedium,
  EnergyActive,
  EnergyCharged,
  StressExtreme,
  StressHigh,
  StressNeutral,
  StressCalm,
  StressZen,
} from './CheckInIcons';

export interface CheckInOption {
  value: number;
  icon: ComponentType<{ color: string }>;
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
    label: 'Sleep',
    options: [
      { value: 1, icon: SleepPoor, label: 'Bad', color: '#e5484d' },
      { value: 2, icon: SleepFair, label: 'Poor', color: '#f08c00' },
      { value: 3, icon: SleepGood, label: 'OK', color: '#f5c518' },
      { value: 4, icon: SleepGreat, label: 'Good', color: '#6bcb77' },
      { value: 5, icon: SleepDeep, label: 'Great', color: '#2fb344' },
    ],
  },
  {
    key: 'mood',
    label: 'Mood',
    options: [
      { value: 1, icon: MoodAwful, label: 'Bad', color: '#e5484d' },
      { value: 2, icon: MoodBad, label: 'Poor', color: '#f08c00' },
      { value: 3, icon: MoodMeh, label: 'OK', color: '#f5c518' },
      { value: 4, icon: MoodGood, label: 'Good', color: '#6bcb77' },
      { value: 5, icon: MoodAwesome, label: 'Great', color: '#2fb344' },
    ],
  },
  {
    key: 'energy',
    label: 'Energy',
    options: [
      { value: 1, icon: EnergyDrained, label: 'Drained', color: '#e5484d' },
      { value: 2, icon: EnergyLow, label: 'Low', color: '#f08c00' },
      { value: 3, icon: EnergyMedium, label: 'OK', color: '#f5c518' },
      { value: 4, icon: EnergyActive, label: 'High', color: '#6bcb77' },
      { value: 5, icon: EnergyCharged, label: 'Full', color: '#2fb344' },
    ],
  },
  {
    key: 'stress',
    label: 'Stress',
    options: [
      { value: 1, icon: StressExtreme, label: 'Extreme', color: '#e5484d' },
      { value: 2, icon: StressHigh, label: 'High', color: '#f08c00' },
      { value: 3, icon: StressNeutral, label: 'OK', color: '#f5c518' },
      { value: 4, icon: StressCalm, label: 'Low', color: '#6bcb77' },
      { value: 5, icon: StressZen, label: 'None', color: '#2fb344' },
    ],
  },
];

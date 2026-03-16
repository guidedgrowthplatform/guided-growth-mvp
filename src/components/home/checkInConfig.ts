import type { ComponentType } from 'react';
import type { CheckInDimension } from '@shared/types';
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
    label: 'Sleep Quality',
    options: [
      { value: 1, icon: SleepPoor, label: 'Poor', color: '#e5484d' },
      { value: 2, icon: SleepFair, label: 'Fair', color: '#f08c00' },
      { value: 3, icon: SleepGood, label: 'Good', color: '#f5c518' },
      { value: 4, icon: SleepGreat, label: 'Great', color: '#6bcb77' },
      { value: 5, icon: SleepDeep, label: 'Deep!', color: '#2fb344' },
    ],
  },
  {
    key: 'mood',
    label: 'Mood',
    options: [
      { value: 1, icon: MoodAwful, label: 'Awful', color: '#e5484d' },
      { value: 2, icon: MoodBad, label: 'Bad', color: '#f08c00' },
      { value: 3, icon: MoodMeh, label: 'Meh', color: '#f5c518' },
      { value: 4, icon: MoodGood, label: 'Good', color: '#6bcb77' },
      { value: 5, icon: MoodAwesome, label: 'Awesome!', color: '#2fb344' },
    ],
  },
  {
    key: 'energy',
    label: 'Energy Level',
    options: [
      { value: 1, icon: EnergyDrained, label: 'Drained', color: '#e5484d' },
      { value: 2, icon: EnergyLow, label: 'Low', color: '#f08c00' },
      { value: 3, icon: EnergyMedium, label: 'Medium', color: '#f5c518' },
      { value: 4, icon: EnergyActive, label: 'Active', color: '#6bcb77' },
      { value: 5, icon: EnergyCharged, label: 'Charged', color: '#2fb344' },
    ],
  },
  {
    key: 'stress',
    label: 'Stress Level',
    options: [
      { value: 1, icon: StressExtreme, label: 'Extreme', color: '#e5484d' },
      { value: 2, icon: StressHigh, label: 'High', color: '#f08c00' },
      { value: 3, icon: StressNeutral, label: 'Neutral', color: '#f5c518' },
      { value: 4, icon: StressCalm, label: 'Calm', color: '#6bcb77' },
      { value: 5, icon: StressZen, label: 'Zen', color: '#2fb344' },
    ],
  },
];

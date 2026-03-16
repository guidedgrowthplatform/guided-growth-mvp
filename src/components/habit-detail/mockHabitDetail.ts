export interface HabitDetail {
  id: string;
  name: string;
  description: string;
  activeDays: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  frequencyLabel: string;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  failedDays: number;
  totalRepetitions: number;
  sinceDate: string;
  calendarMonth: string;
  calendarData: ('done' | 'missed' | 'empty')[][];
  milestones: { target: number; earned: boolean }[];
}

export const habitDetails: Record<string, HabitDetail> = {
  '1': {
    id: '1',
    name: 'Morning Mindfulness',
    description:
      'Start each day with a 10-minute guided meditation session to center your thoughts and set positive intentions.',
    activeDays: [false, true, true, true, true, false, false],
    frequencyLabel: '4x / week at 06:20 AM',
    currentStreak: 12,
    longestStreak: 14,
    completionRate: 85,
    failedDays: 2,
    totalRepetitions: 24,
    sinceDate: 'March 1',
    calendarMonth: 'March',
    calendarData: [
      ['empty', 'done', 'done', 'done', 'done', 'empty', 'empty'],
      ['empty', 'done', 'done', 'missed', 'done', 'empty', 'empty'],
      ['empty', 'done', 'done', 'done', 'done', 'empty', 'empty'],
      ['empty', 'done', 'missed', 'done', 'done', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ],
    milestones: [
      { target: 7, earned: true },
      { target: 21, earned: true },
      { target: 30, earned: false },
      { target: 60, earned: false },
      { target: 90, earned: false },
    ],
  },
  '2': {
    id: '2',
    name: 'Daily Hydration',
    description:
      'Drink at least 8 glasses of water throughout the day to stay hydrated and energized.',
    activeDays: [true, true, true, true, true, true, true],
    frequencyLabel: '7x / week',
    currentStreak: 2,
    longestStreak: 10,
    completionRate: 70,
    failedDays: 5,
    totalRepetitions: 16,
    sinceDate: 'March 1',
    calendarMonth: 'March',
    calendarData: [
      ['done', 'done', 'done', 'missed', 'done', 'done', 'done'],
      ['missed', 'done', 'done', 'done', 'missed', 'done', 'done'],
      ['done', 'done', 'missed', 'done', 'done', 'missed', 'done'],
      ['done', 'done', 'empty', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ],
    milestones: [
      { target: 7, earned: true },
      { target: 21, earned: false },
      { target: 30, earned: false },
      { target: 60, earned: false },
    ],
  },
  '3': {
    id: '3',
    name: 'Deep Reading Novel',
    description: 'Read for at least 30 minutes daily to expand your knowledge and improve focus.',
    activeDays: [true, true, true, true, true, true, true],
    frequencyLabel: '7x / week at 09:00 PM',
    currentStreak: 14,
    longestStreak: 14,
    completionRate: 92,
    failedDays: 1,
    totalRepetitions: 14,
    sinceDate: 'March 3',
    calendarMonth: 'March',
    calendarData: [
      ['empty', 'empty', 'done', 'done', 'done', 'done', 'done'],
      ['done', 'done', 'done', 'done', 'missed', 'done', 'done'],
      ['done', 'done', 'done', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ],
    milestones: [
      { target: 7, earned: true },
      { target: 21, earned: false },
      { target: 30, earned: false },
    ],
  },
  '4': {
    id: '4',
    name: 'Afternoon Walk',
    description: 'Take a brisk walk of at least 10,000 steps to stay active and clear your mind.',
    activeDays: [false, true, true, true, true, true, false],
    frequencyLabel: '5x / week at 04:00 PM',
    currentStreak: 12,
    longestStreak: 20,
    completionRate: 88,
    failedDays: 3,
    totalRepetitions: 22,
    sinceDate: 'Feb 20',
    calendarMonth: 'March',
    calendarData: [
      ['empty', 'done', 'done', 'done', 'done', 'done', 'empty'],
      ['empty', 'done', 'missed', 'done', 'done', 'done', 'empty'],
      ['empty', 'done', 'done', 'done', 'missed', 'done', 'empty'],
      ['empty', 'done', 'done', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ],
    milestones: [
      { target: 7, earned: true },
      { target: 21, earned: true },
      { target: 30, earned: false },
      { target: 60, earned: false },
    ],
  },
};

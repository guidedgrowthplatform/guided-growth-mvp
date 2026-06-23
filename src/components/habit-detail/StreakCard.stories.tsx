import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CalendarCell } from '@/hooks/useHabitDetail';
import { StreakCard } from './StreakCard';

const calendarData: CalendarCell[][] = [
  [
    { day: null, status: 'empty' },
    { day: 1, status: 'done' },
    { day: 2, status: 'missed' },
    { day: 3, status: 'done' },
    { day: 4, status: 'today' },
    { day: 5, status: 'scheduled-future' },
    { day: 6, status: 'unscheduled-future' },
  ],
];

const meta = {
  title: 'Habit Detail/Streak Card',
  component: StreakCard,
  args: { currentStreak: 4, calendarMonth: 'June', totalRepetitions: 18, sinceDate: 'June 1', calendarData },
} satisfies Meta<typeof StreakCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CalendarCell } from '@/hooks/useHabitDetail';
import { StreakCalendarGrid } from './StreakCalendarGrid';

const meta = {
  title: 'Habit Detail/Streak Calendar Grid',
  component: StreakCalendarGrid,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StreakCalendarGrid>;
export default meta;

type Story = StoryObj<typeof meta>;

const c = (status: CalendarCell['status'], day: number | null): CalendarCell => ({ status, day });

// A representative month: leading pad, a streak, a few misses, off-days, today, future.
const month: CalendarCell[][] = [
  [c('empty', null), c('empty', null), c('done', 1), c('done', 2), c('missed', 3), c('done', 4), c('unscheduled-past', 5)],
  [c('done', 6), c('done', 7), c('done', 8), c('missed', 9), c('done', 10), c('done', 11), c('unscheduled-past', 12)],
  [c('done', 13), c('done', 14), c('done', 15), c('done', 16), c('missed', 17), c('done', 18), c('unscheduled-past', 19)],
  [c('done', 20), c('done', 21), c('today-done', 22), c('scheduled-future', 23), c('unscheduled-future', 24), c('scheduled-future', 25), c('unscheduled-future', 26)],
  [c('scheduled-future', 27), c('scheduled-future', 28), c('unscheduled-future', 29), c('scheduled-future', 30), c('empty', null), c('empty', null), c('empty', null)],
];

export const Default: Story = {
  args: { data: month },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitPerformanceList } from './HabitPerformanceList';

const meta = {
  title: 'Insights/Habit Performance List',
  component: HabitPerformanceList,
  args: { habits: [{ name: 'Morning walk', percentage: 82, streak: '6 day streak', weeklyData: [40, 60, 70, 85, 80, 90, 82], bestDay: 'Friday', totalCompletions: 24 }] },
} satisfies Meta<typeof HabitPerformanceList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { habits: [] } };

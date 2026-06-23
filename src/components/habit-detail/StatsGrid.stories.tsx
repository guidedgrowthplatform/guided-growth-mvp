import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatsGrid } from './StatsGrid';

const meta = {
  title: 'HabitDetail/StatsGrid',
  component: StatsGrid,
  args: {
    completionRate: 78,
    currentStreak: 5,
    longestStreak: 14,
    failedDays: 3,
  },
} satisfies Meta<typeof StatsGrid>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PerfectStreak: Story = {
  args: {
    completionRate: 100,
    currentStreak: 30,
    longestStreak: 30,
    failedDays: 0,
  },
};

export const LowEngagement: Story = {
  args: {
    completionRate: 20,
    currentStreak: 0,
    longestStreak: 4,
    failedDays: 12,
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitCompletionCard } from './HabitCompletionCard';

const meta = {
  title: 'Insights/Habit Completion Card',
  component: HabitCompletionCard,
  args: { timeRange: 'week', completionByRange: { week: { percentage: 76, trend: '+8%', trendPositive: true, subtitle: 'this week', bars: [{ label: 'Mon', value: 80 }, { label: 'Tue', value: 60 }, { label: 'Wed', value: 90 }] } } },
} satisfies Meta<typeof HabitCompletionCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DownTrend: Story = { args: { completionByRange: { week: { percentage: 42, trend: '-12%', trendPositive: false, subtitle: 'this week', bars: [{ label: 'Mon', value: 40 }, { label: 'Tue', value: 35 }] } } } };

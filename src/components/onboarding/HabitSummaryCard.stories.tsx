import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitSummaryCard } from './HabitSummaryCard';

const meta = {
  title: 'Onboarding/Habit Summary Card',
  component: HabitSummaryCard,
  args: { onEdit: () => {} },
} satisfies Meta<typeof HabitSummaryCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    habitName: 'Wind down without a screen',
    selectedDays: new Set([1, 2, 3, 4, 5]),
  },
};

export const WithCheckmark: Story = {
  args: {
    habitName: 'Morning walk',
    selectedDays: new Set([0, 6]),
    showCheckmark: true,
  },
};

export const AiSuggested: Story = {
  args: {
    habitName: '10 minute stretch',
    selectedDays: new Set([1, 3, 5]),
    showAiIcon: true,
    showEditIcon: true,
  },
};

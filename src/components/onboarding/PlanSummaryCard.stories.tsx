import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanSummaryCard } from './PlanSummaryCard';

const meta = {
  title: 'Onboarding/Plan Summary Card',
  component: PlanSummaryCard,
  args: { onEdit: () => {} },
} satisfies Meta<typeof PlanSummaryCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Habit: Story = {
  args: {
    icon: 'mdi:bed-outline',
    typeLabel: 'Habit',
    title: 'Wind down without a screen',
    cadence: 'Every day',
    rule: '30 min before bed',
  },
};

export const Journal: Story = {
  args: {
    icon: 'mdi:notebook-outline',
    typeLabel: 'Journal',
    title: 'Evening reflection',
    cadence: 'Weekdays',
    rule: '1 prompt',
  },
};

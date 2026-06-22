import type { Meta, StoryObj } from '@storybook/react-vite';
import { GoalCard } from './GoalCard';

const meta = {
  title: 'Onboarding/Goal Card',
  component: GoalCard,
  args: { onToggle: () => {} },
} satisfies Meta<typeof GoalCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Fall asleep faster', selected: false },
};

export const Selected: Story = {
  args: { label: 'Fall asleep faster', selected: true },
};

export const Disabled: Story = {
  args: { label: 'Sleep through the night', selected: false, disabled: true },
};

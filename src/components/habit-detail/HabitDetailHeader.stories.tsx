import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitDetailTopBar, HabitDetailTitle } from './HabitDetailHeader';

const meta = {
  title: 'HabitDetail/HabitDetailHeader',
  component: HabitDetailTopBar,
  args: {
    onClose: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof HabitDetailTopBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDelete: Story = {
  args: {
    onDelete: undefined,
  },
};

export const Title: Story = {
  render: () => (
    <HabitDetailTitle
      name="Morning Run"
      description="Start the day with 30 minutes of cardio to build consistency and energy."
    />
  ),
};

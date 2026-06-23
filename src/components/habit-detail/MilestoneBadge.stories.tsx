import type { Meta, StoryObj } from '@storybook/react-vite';
import { MilestoneBadge } from './MilestoneBadge';

const meta = {
  title: 'Habit Detail/Milestone Badge',
  component: MilestoneBadge,
  args: {
    target: 7,
    earned: false,
  },
} satisfies Meta<typeof MilestoneBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Earned: Story = {
  args: {
    earned: true,
  },
};

export const LongerStreak: Story = {
  args: {
    target: 30,
    earned: true,
  },
};

export const UnearmedLongStreak: Story = {
  args: {
    target: 100,
    earned: false,
  },
};

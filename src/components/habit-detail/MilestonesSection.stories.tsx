import type { Meta, StoryObj } from '@storybook/react-vite';
import { MilestonesSection } from './MilestonesSection';

const meta = {
  title: 'HabitDetail/MilestonesSection',
  component: MilestonesSection,
  args: {
    milestones: [
      { target: 7, earned: true },
      { target: 14, earned: true },
      { target: 30, earned: false },
      { target: 60, earned: false },
      { target: 100, earned: false },
    ],
  },
} satisfies Meta<typeof MilestonesSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoneEarned: Story = {
  args: {
    milestones: [
      { target: 7, earned: false },
      { target: 14, earned: false },
      { target: 30, earned: false },
    ],
  },
};

export const AllEarned: Story = {
  args: {
    milestones: [
      { target: 7, earned: true },
      { target: 14, earned: true },
      { target: 30, earned: true },
      { target: 60, earned: true },
      { target: 100, earned: true },
    ],
  },
};

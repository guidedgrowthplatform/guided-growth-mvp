import type { Meta, StoryObj } from '@storybook/react-vite';
import { DaySchedulePills } from './DaySchedulePills';

const meta = {
  title: 'Habit Detail/Day Schedule Pills',
  component: DaySchedulePills,
  args: {
    activeDays: [false, true, true, true, true, true, false],
    frequencyLabel: '5 days a week',
  },
} satisfies Meta<typeof DaySchedulePills>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Everyday: Story = {
  args: {
    activeDays: [true, true, true, true, true, true, true],
    frequencyLabel: 'Every day',
  },
};

export const Weekdays: Story = {
  args: {
    activeDays: [false, true, true, true, true, true, false],
    frequencyLabel: 'Weekdays only',
  },
};

export const OnceAWeek: Story = {
  args: {
    activeDays: [false, false, false, true, false, false, false],
    frequencyLabel: 'Once a week',
  },
};

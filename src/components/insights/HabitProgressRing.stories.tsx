import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitProgressRing } from './HabitProgressRing';

const meta = {
  title: 'Insights/Habit Progress Ring',
  component: HabitProgressRing,
  args: { percentage: 72, size: 56, strokeWidth: 5, animate: true },
} satisfies Meta<typeof HabitProgressRing>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Complete: Story = { args: { percentage: 100 } };
export const Static: Story = { args: { animate: false } };

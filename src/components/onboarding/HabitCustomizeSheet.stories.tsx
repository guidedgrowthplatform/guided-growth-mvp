import type { Meta, StoryObj } from '@storybook/react-vite';
import { HabitCustomizeSheet } from './HabitCustomizeSheet';

const meta = {
  title: 'Onboarding/Habit Customize Sheet',
  component: HabitCustomizeSheet,
  args: { habitName: 'Morning walk', onClose: () => {}, onNext: () => {}, isLastHabit: false },
} satisfies Meta<typeof HabitCustomizeSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LastHabit: Story = { args: { isLastHabit: true } };

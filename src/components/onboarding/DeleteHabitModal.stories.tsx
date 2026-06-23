import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeleteHabitModal } from './DeleteHabitModal';

const meta = {
  title: 'Onboarding/Delete Habit Modal',
  component: DeleteHabitModal,
  args: { onDelete: () => {}, onKeep: () => {} },
} satisfies Meta<typeof DeleteHabitModal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

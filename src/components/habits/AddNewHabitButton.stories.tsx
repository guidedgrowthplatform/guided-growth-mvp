import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { AddNewHabitButton } from './AddNewHabitButton';

// Uses useNavigate(); wrapped in MemoryRouter so it renders standalone.
const meta = {
  title: 'Habits/Add New Habit Button',
  component: AddNewHabitButton,
  decorators: [(Story) => (
    <MemoryRouter>
      <Story />
    </MemoryRouter>
  )],
} satisfies Meta<typeof AddNewHabitButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

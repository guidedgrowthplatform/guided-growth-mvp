import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { HabitsSection } from './HabitsSection';

// note: this component reads app data, toast, and session providers to render live.
const meta = {
  title: 'Home/Habits Section',
  component: HabitsSection,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: { selectedDate: '2026-06-23', screenId: 'HOME-01' },
} satisfies Meta<typeof HabitsSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

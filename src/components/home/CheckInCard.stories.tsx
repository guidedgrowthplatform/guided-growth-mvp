import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { CheckInCard } from './CheckInCard';

// note: this component reads app hooks/providers and may need query, toast, preferences, and coach chat providers to render live.
const meta = {
  title: 'Home/Check In Card',
  component: CheckInCard,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: { selectedDate: '2026-06-23', onClose: () => {} },
} satisfies Meta<typeof CheckInCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

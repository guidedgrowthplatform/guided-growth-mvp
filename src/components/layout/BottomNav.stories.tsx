import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';

// note: this component reads voice, session, and preference stores/providers to render live.
const meta = {
  title: 'Layout/Bottom Nav',
  component: BottomNav,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: { hidden: false },
} satisfies Meta<typeof BottomNav>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hidden: Story = { args: { hidden: true } };

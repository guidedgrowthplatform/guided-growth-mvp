import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

// note: this component mounts app chat, voice, toast, and navigation providers to render live.
const meta = {
  title: 'Layout/Layout',
  component: Layout,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: { children: <div className="min-h-64 rounded-lg bg-surface-secondary p-6">Page content</div> },
} satisfies Meta<typeof Layout>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

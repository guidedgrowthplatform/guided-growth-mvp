import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconMicMuted } from './IconMicMuted';

const meta = {
  title: 'Icons/IconMicMuted',
  component: IconMicMuted,
  args: { size: 32 },
} satisfies Meta<typeof IconMicMuted>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: 64 } };

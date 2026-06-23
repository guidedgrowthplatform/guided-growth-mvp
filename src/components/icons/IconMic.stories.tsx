import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconMic } from './IconMic';

const meta = {
  title: 'Icons/IconMic',
  component: IconMic,
  args: { size: 32 },
} satisfies Meta<typeof IconMic>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: 64 } };

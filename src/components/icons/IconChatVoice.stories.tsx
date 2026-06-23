import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconChatVoice } from './IconChatVoice';

const meta = {
  title: 'Icons/IconChatVoice',
  component: IconChatVoice,
  args: { size: 32 },
} satisfies Meta<typeof IconChatVoice>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: 64 } };

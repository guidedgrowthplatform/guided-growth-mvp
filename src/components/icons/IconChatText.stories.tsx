import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconChatText } from './IconChatText';

const meta = {
  title: 'Icons/IconChatText',
  component: IconChatText,
  args: { size: 32 },
} satisfies Meta<typeof IconChatText>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: 64 } };

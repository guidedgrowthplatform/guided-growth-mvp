import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatBubble } from './ChatBubble';

const meta = {
  title: 'Voice/Chat Bubble',
  component: ChatBubble,
  args: { role: 'ai', text: 'What would make this habit easier today?', userName: 'Yair', animate: false, eyebrowVariant: 'light', compact: false, streaming: false, markdown: false },
} satisfies Meta<typeof ChatBubble>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const User: Story = { args: { role: 'user', text: 'I can start with ten minutes.', eyebrowVariant: 'dark' } };
export const Streaming: Story = { args: { streaming: true } };

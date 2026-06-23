import type { Meta, StoryObj } from '@storybook/react-vite';
import { OpenChatButton } from './OpenChatButton';

const meta = {
  title: 'Home/Open Chat Button',
  component: OpenChatButton,
  args: { onPress: () => {} },
} satisfies Meta<typeof OpenChatButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Floating: Story = { args: { floating: true } };

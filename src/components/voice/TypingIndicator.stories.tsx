import type { Meta, StoryObj } from '@storybook/react-vite';
import { TypingIndicator } from './TypingIndicator';

const meta = {
  title: 'Voice/Typing Indicator',
  component: TypingIndicator,
} satisfies Meta<typeof TypingIndicator>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

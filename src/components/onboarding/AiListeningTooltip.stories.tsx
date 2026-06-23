import type { Meta, StoryObj } from '@storybook/react-vite';
import { AiListeningTooltip } from './AiListeningTooltip';

const meta = {
  title: 'Onboarding/Ai Listening Tooltip',
  component: AiListeningTooltip,
  args: { text: 'Tell me what you want to build.', visible: true },
} satisfies Meta<typeof AiListeningTooltip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hidden: Story = { args: { visible: false } };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { VoiceTooltip } from './VoiceTooltip';

const meta = {
  title: 'Onboarding/Voice Tooltip',
  component: VoiceTooltip,
  args: { autoDismissMs: 0, onDismiss: () => {} },
} satisfies Meta<typeof VoiceTooltip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

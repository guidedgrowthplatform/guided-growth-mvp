import type { Meta, StoryObj } from '@storybook/react-vite';
import { VoiceCapModal } from './VoiceCapModal';

// note: this component reads onboarding voice session context to render live.
const meta = {
  title: 'Voice/Voice Cap Modal',
  component: VoiceCapModal,
} satisfies Meta<typeof VoiceCapModal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

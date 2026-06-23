import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingChatOverlay } from './OnboardingChatOverlay';

// note: this component reads onboarding voice/chat providers to render live.
const meta = {
  title: 'Onboarding/Onboarding Chat Overlay',
  component: OnboardingChatOverlay,
  args: { onClose: () => {} },
} satisfies Meta<typeof OnboardingChatOverlay>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

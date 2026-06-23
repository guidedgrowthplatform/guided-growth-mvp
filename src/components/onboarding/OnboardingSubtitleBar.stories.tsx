import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingSubtitleBar } from './OnboardingSubtitleBar';

// note: this component reads onboarding voice session context to render live.
const meta = {
  title: 'Onboarding/Onboarding Subtitle Bar',
  component: OnboardingSubtitleBar,
} satisfies Meta<typeof OnboardingSubtitleBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

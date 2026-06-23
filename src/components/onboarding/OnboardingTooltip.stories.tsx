import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingTooltip } from './OnboardingTooltip';

const meta = {
  title: 'Onboarding/Onboarding Tooltip',
  component: OnboardingTooltip,
  args: { title: 'Try voice', message: 'You can answer this step out loud.' },
} satisfies Meta<typeof OnboardingTooltip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

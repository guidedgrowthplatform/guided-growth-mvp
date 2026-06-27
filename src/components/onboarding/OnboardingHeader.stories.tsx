import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingHeader } from './OnboardingHeader';

const meta = {
  title: 'Onboarding/Onboarding Header',
  component: OnboardingHeader,
} satisfies Meta<typeof OnboardingHeader>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'What feels most worth improving right now?',
    subtitle: 'Pick the area you want to focus on first.',
  },
};

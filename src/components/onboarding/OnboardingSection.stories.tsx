import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingSection } from './OnboardingSection';

const meta = {
  title: 'Onboarding/Onboarding Section',
  component: OnboardingSection,
  args: { label: 'Your focus', children: <p className="text-sm text-content-secondary">Build a steady morning rhythm.</p> },
} satisfies Meta<typeof OnboardingSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

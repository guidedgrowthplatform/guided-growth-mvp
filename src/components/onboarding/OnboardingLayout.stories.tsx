import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingLayout } from './OnboardingLayout';

// note: this component can open onboarding voice/chat surfaces and may need their providers to render live.
const meta = {
  title: 'Onboarding/Onboarding Layout',
  component: OnboardingLayout,
  args: { ctaLabel: 'Continue', onNext: () => {}, children: <div className="rounded-lg bg-surface p-4">Onboarding step content</div>, ctaDisabled: false, ctaLoading: false },
} satisfies Meta<typeof OnboardingLayout>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { ctaDisabled: true } };
export const Loading: Story = { args: { ctaLoading: true } };

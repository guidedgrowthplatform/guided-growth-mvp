import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { OnboardingInput } from './OnboardingInput';

const meta = {
  title: 'Onboarding/Onboarding Input',
  component: OnboardingInput,
  args: {
    icon: 'mdi:account-outline',
    placeholder: 'What should I call you?',
    value: '',
    onChange: () => {},
  },
} satisfies Meta<typeof OnboardingInput>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Name: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <OnboardingInput
        icon="mdi:account-outline"
        placeholder="What should I call you?"
        value={value}
        onChange={setValue}
      />
    );
  },
};

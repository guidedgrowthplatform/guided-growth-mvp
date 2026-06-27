import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { AgeScrollPicker } from './AgeScrollPicker';

const meta = {
  title: 'Onboarding/Age Scroll Picker',
  component: AgeScrollPicker,
  args: {
    value: 0,
    onChange: () => {},
  },
} satisfies Meta<typeof AgeScrollPicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [age, setAge] = useState<number | ''>(28);
    return <AgeScrollPicker value={age} onChange={setAge} />;
  },
};

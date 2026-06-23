import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChipSelect } from './ChipSelect';

const meta = {
  title: 'UI/Chip Select',
  component: ChipSelect,
  args: {
    options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
    value: 'Male',
    onChange: () => {},
  },
} satisfies Meta<typeof ChipSelect>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Gender: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>('Male');
    return (
      <ChipSelect
        options={['Male', 'Female', 'Non-binary', 'Prefer not to say']}
        value={value}
        onChange={setValue}
        ariaLabel="How do you identify?"
        columns={2}
      />
    );
  },
};

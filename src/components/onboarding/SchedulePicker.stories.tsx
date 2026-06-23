import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SchedulePicker, type ScheduleOption } from './SchedulePicker';

const meta = {
  title: 'UI/Schedule Picker',
  component: SchedulePicker,
  args: { value: 'Every day', onChange: () => {} },
} satisfies Meta<typeof SchedulePicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<ScheduleOption>('Every day');
    return <SchedulePicker value={value} onChange={setValue} />;
  },
};

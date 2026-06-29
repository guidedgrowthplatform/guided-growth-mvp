import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DayPicker } from './DayPicker';

const meta = {
  title: 'UI/Day Picker',
  component: DayPicker,
  args: {
    selectedDays: new Set<number>(),
    onToggleDay: () => {},
  },
} satisfies Meta<typeof DayPicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => {
    const [days, setDays] = useState<Set<number>>(new Set([1, 3, 5]));
    return (
      <DayPicker
        selectedDays={days}
        onToggleDay={(d) =>
          setDays((prev) => {
            const next = new Set(prev);
            if (next.has(d)) next.delete(d);
            else next.add(d);
            return next;
          })
        }
      />
    );
  },
};

export const ReadOnly: Story = {
  render: () => <DayPicker selectedDays={new Set([0, 6])} onToggleDay={() => {}} disabled />,
};

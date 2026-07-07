import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DailyReflectionCard } from './DailyReflectionCard';

const meta = {
  title: 'Onboarding/Daily Reflection Card',
  component: DailyReflectionCard,
  args: {
    time: '21:00',
    onTimeChange: () => {},
    days: new Set<number>(),
    onToggleDay: () => {},
    reminder: false,
    onToggleReminder: () => {},
  },
} satisfies Meta<typeof DailyReflectionCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [time, setTime] = useState('21:30');
    const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
    const [reminder, setReminder] = useState(true);
    return (
      <DailyReflectionCard
        time={time}
        onTimeChange={setTime}
        days={days}
        onToggleDay={(d) =>
          setDays((prev) => {
            const next = new Set(prev);
            if (next.has(d)) next.delete(d);
            else next.add(d);
            return next;
          })
        }
        reminder={reminder}
        onToggleReminder={setReminder}
      />
    );
  },
};

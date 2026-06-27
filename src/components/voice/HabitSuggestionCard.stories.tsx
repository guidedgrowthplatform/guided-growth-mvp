import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HabitSuggestionCard } from './HabitSuggestionCard';

const meta = {
  title: 'Check-in/Habit Suggestion Card',
  component: HabitSuggestionCard,
  args: {
    name: 'Sample',
    days: [],
    onDaysChange: () => {},
  },
} satisfies Meta<typeof HabitSuggestionCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
    return (
      <HabitSuggestionCard
        name="Drink water after waking"
        days={days}
        onDaysChange={setDays}
        onEdit={() => {}}
      />
    );
  },
};

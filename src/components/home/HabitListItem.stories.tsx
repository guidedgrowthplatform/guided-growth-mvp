import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HabitListItem } from './HabitListItem';

const meta = {
  title: 'Home/Habit List Item',
  component: HabitListItem,
  args: {
    name: 'Sample',
    streak: 0,
    isCompleted: false,
    onToggleComplete: () => {},
  },
} satisfies Meta<typeof HabitListItem>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [done, setDone] = useState(false);
    return (
      <HabitListItem
        name="Wind down without a screen"
        subtitle="30 min before bed"
        streak={5}
        isCompleted={done}
        onToggleComplete={() => setDone((d) => !d)}
        hasNote
        onAddNote={() => {}}
        onClick={() => {}}
        onDelete={() => {}}
      />
    );
  },
};

export const Completed: Story = {
  render: () => {
    const [done, setDone] = useState(true);
    return (
      <HabitListItem
        name="Morning walk"
        streak={12}
        isCompleted={done}
        onToggleComplete={() => setDone((d) => !d)}
      />
    );
  },
};

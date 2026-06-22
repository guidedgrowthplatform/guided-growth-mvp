import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HabitPickerPanel } from './HabitPickerPanel';

const meta = {
  title: 'Onboarding/Habit Picker Panel',
  component: HabitPickerPanel,
} satisfies Meta<typeof HabitPickerPanel>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  render: () => {
    const [expanded, setExpanded] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set(['Wind down without a screen']));
    const habits = [
      'Wind down without a screen',
      'No caffeine after 2pm',
      'Same bedtime every night',
    ];
    return (
      <HabitPickerPanel
        goal="Sleep better"
        habits={habits}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((v) => !v)}
        selectedHabits={selected}
        onToggleHabit={(h) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(h)) next.delete(h);
            else next.add(h);
            return next;
          })
        }
        onAddCustomHabit={(h) => setSelected((prev) => new Set(prev).add(h))}
      />
    );
  },
};

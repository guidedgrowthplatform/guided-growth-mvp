import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HabitScheduleCard, type HabitPolarity } from './HabitScheduleCard';

const meta: Meta<typeof HabitScheduleCard> = {
  title: 'Onboarding/Habit Schedule Card',
  component: HabitScheduleCard,
};
export default meta;

type Story = StoryObj<typeof meta>;

function toggle(set: Set<number>, d: number): Set<number> {
  const n = new Set(set);
  if (n.has(d)) n.delete(d);
  else n.add(d);
  return n;
}

// Approved shape: no frequency dropdown, days default to weekdays and are
// toggleable, Build/Break plus Edit plus Delete, thicker day pills.
function Card({ name, start }: { name: string; start: number[] }) {
  const [days, setDays] = useState<Set<number>>(new Set(start));
  const [polarity, setPolarity] = useState<HabitPolarity>('build');
  return (
    <div style={{ maxWidth: 360 }}>
      <HabitScheduleCard
        habitName={name}
        polarity={polarity}
        selectedDays={days}
        onChangePolarity={setPolarity}
        onToggleDay={(d) => setDays((p) => toggle(p, d))}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <Card name="Morning walk" start={[1, 2, 3, 4, 5]} />,
};

// A long name wraps to two lines, never cut.
export const LongName: Story = {
  render: () => <Card name="No screens for an hour before bed" start={[1, 2, 3, 4, 5]} />,
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HabitListItem } from './HabitListItem';
import { SectionHeader } from './SectionHeader';

interface MockHabit {
  id: string;
  name: string;
  subtitle: string;
  streak: number;
  completed: boolean;
}

const initialHabits: MockHabit[] = [
  { id: '1', name: 'Morning Mindfulness', subtitle: '1 session', streak: 6, completed: false },
  { id: '2', name: 'Daily Hydration', subtitle: '8 glasses', streak: 2, completed: true },
  { id: '3', name: 'Deep Reading Novel...', subtitle: '30 mins', streak: 14, completed: false },
  { id: '4', name: 'Afternoon Walk', subtitle: '10,000 steps', streak: 12, completed: false },
];

interface HabitsSectionProps {
  selectedDate: string;
}

export function HabitsSection({ selectedDate: _selectedDate }: HabitsSectionProps) {
  const navigate = useNavigate();
  const [habits, setHabits] = useState(initialHabits);

  const handleToggle = (id: string) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h)));
  };

  return (
    <div>
      <SectionHeader
        title="Today's Habits"
        actionLabel="See all"
        onAction={() => navigate('/habits')}
      />
      <div className="flex flex-col gap-3">
        {habits.map((habit) => (
          <HabitListItem
            key={habit.id}
            name={habit.name}
            subtitle={habit.subtitle}
            streak={habit.streak}
            isCompleted={habit.completed}
            onToggleComplete={() => handleToggle(habit.id)}
            onClick={() => navigate('/habit/' + habit.id)}
          />
        ))}
      </div>
    </div>
  );
}

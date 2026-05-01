import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { useToast } from '@/contexts/ToastContext';
import { useHabitsForDate } from '@/hooks/useHabitsForDate';
import { HabitListItem } from './HabitListItem';
import { SectionHeader } from './SectionHeader';

interface HabitsSectionProps {
  selectedDate: string;
}

export function HabitsSection({ selectedDate }: HabitsSectionProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { habits, loading, error, toggleComplete, reload } = useHabitsForDate(selectedDate);

  const handleAddNote = (habitName: string) => {
    window.dispatchEvent(new CustomEvent('toggle-journal'));
    addToast('info', `Add a note for "${habitName}"`);
  };

  const handleToggle = async (habitId: string, currentlyCompleted: boolean) => {
    const target = habits.find((h) => h.habit.id === habitId);
    try {
      await toggleComplete(habitId, currentlyCompleted);
      if (target && !currentlyCompleted) {
        const now = new Date();
        const hour = now.getHours();
        const timeOfDay =
          hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
        track('complete_habit', {
          habit_name: target.habit.name,
          current_streak: target.streak + 1,
          day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
          time_of_day: timeOfDay,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle habit';
      addToast('error', msg);
    }
  };

  if (loading && habits.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Today's Habits"
          actionLabel="See all"
          onAction={() => navigate('/habits')}
        />
        <HabitSkeleton count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader
          title="Today's Habits"
          actionLabel="See all"
          onAction={() => navigate('/habits')}
        />
        <div className="flex flex-col gap-3 rounded-2xl bg-surface px-6 py-8">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <span className="text-sm font-bold text-danger">!</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-content">Unable to load habits</p>
              <p className="mt-1 text-xs text-content-secondary">
                We're having trouble fetching your habits. Please try again.
              </p>
            </div>
          </div>
          <button
            onClick={reload}
            className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div>
        <SectionHeader
          title="Today's Habits"
          actionLabel="See all"
          onAction={() => navigate('/habits')}
        />
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-8 text-center">
          <p className="text-sm font-medium text-content">No habits yet</p>
          <p className="text-xs text-content-secondary">
            Build your routine — add your first habit.
          </p>
          <button
            onClick={() => navigate('/habits')}
            className="mt-1 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
          >
            Add a habit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Today's Habits"
        actionLabel="See all"
        onAction={() => navigate('/habits')}
      />
      <div className="flex flex-col gap-3">
        {habits.map(({ habit, completed, streak }) => (
          <HabitListItem
            key={habit.id}
            name={habit.name}
            subtitle={habit.frequency}
            streak={streak}
            isCompleted={completed}
            onToggleComplete={() => handleToggle(habit.id, completed)}
            onAddNote={() => handleAddNote(habit.name)}
            onClick={() => navigate('/habit/' + habit.id)}
          />
        ))}
      </div>
    </div>
  );
}

function HabitSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-surface p-4"
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
          <div className="relative flex-1 space-y-2">
            <div className="bg-surface-raised h-4 w-2/3 rounded" />
            <div className="bg-surface-raised h-3 w-1/3 rounded" />
          </div>
          <div className="bg-surface-raised relative h-7 w-7 rounded-full" />
        </div>
      ))}
    </div>
  );
}

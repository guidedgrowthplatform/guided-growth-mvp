import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { AddNewHabitButton } from '@/components/habits/AddNewHabitButton';
import { DailyProgressCard } from '@/components/habits/DailyProgressCard';
import { HabitListItem } from '@/components/home/HabitListItem';
import { useToast } from '@/contexts/ToastContext';
import { useHabitsForDate } from '@/hooks/useHabitsForDate';

export function HabitsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { habits, loading, error, toggleComplete, reload } = useHabitsForDate(today);

  useEffect(() => {
    track('view_habits');
  }, []);

  const completedCount = habits.filter((h) => h.completed).length;

  const handleToggle = async (habitId: string, currentlyCompleted: boolean) => {
    try {
      await toggleComplete(habitId, currentlyCompleted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update habit';
      addToast('error', msg);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8 pt-2">
      <div className="flex flex-col gap-1">
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-secondary active:bg-surface-secondary"
        >
          <Icon icon="mdi:arrow-left" className="h-6 w-6 text-content" />
        </button>
        <h1 className="text-[28px] font-semibold leading-tight text-content">Your Habits</h1>
        <p className="text-sm text-content-secondary">
          Scroll through your thoughts and milestones.
        </p>
      </div>

      {loading && habits.length === 0 ? (
        <div className="flex justify-center py-12">
          <Icon icon="mdi:loading" className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-8 text-center">
          <p className="text-sm text-content">Unable to load habits</p>
          <button
            onClick={reload}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      ) : habits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Icon icon="mdi:playlist-plus" className="h-12 w-12 text-content-secondary" />
          <p className="text-content-secondary">No habits yet. Add your first one below.</p>
        </div>
      ) : (
        <>
          <DailyProgressCard completed={completedCount} total={habits.length} />
          <div className="flex flex-col gap-3">
            {habits.map(({ habit, completed, streak }) => (
              <HabitListItem
                key={habit.id}
                name={habit.name}
                subtitle={habit.frequency}
                streak={streak}
                isCompleted={completed}
                onToggleComplete={() => handleToggle(habit.id, completed)}
                onAddNote={() => navigate(`/habit/${habit.id}/reflection`)}
                onClick={() => navigate(`/habit/${habit.id}`)}
              />
            ))}
          </div>
        </>
      )}

      <AddNewHabitButton />
    </div>
  );
}

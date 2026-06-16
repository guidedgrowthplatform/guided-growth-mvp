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
import type { HabitDayStatus } from '@/lib/services/data-service.interface';
import { formatFrequency } from '@/lib/utils/formatFrequency';

export function HabitsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { habits, loading, error, setHabitStatus, reload } = useHabitsForDate(today, 'HABIT-LIST');

  useEffect(() => {
    track('view_habits');
  }, []);

  const completedCount = habits.filter((h) => h.completed).length;

  const handleSetStatus = async (habitId: string, next: HabitDayStatus) => {
    try {
      await setHabitStatus(habitId, next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update habit';
      addToast('error', msg);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8 pt-2">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
        </button>
        <h1 className="text-[28px] font-semibold leading-tight text-content">Your Habits</h1>
        <p className="text-sm text-content-secondary">
          Scroll through your thoughts and milestones.
        </p>
      </div>

      {loading && habits.length === 0 ? (
        <HabitsPageSkeleton />
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
            {habits.map(({ habit, status, streak }) => (
              <HabitListItem
                key={habit.id}
                name={habit.name}
                subtitle={formatFrequency(habit.frequency)}
                streak={streak}
                status={status}
                habitType={habit.habitType}
                onSetStatus={(next) => handleSetStatus(habit.id, next)}
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

function HabitsPageSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[88px] overflow-hidden rounded-2xl bg-surface">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-surface p-4"
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
          <div className="relative flex-1 space-y-2">
            <div className="bg-surface-raised h-4 w-2/3 rounded" />
            <div className="bg-surface-raised h-3 w-1/3 rounded" />
          </div>
          <div className="bg-surface-raised relative h-8 w-8 rounded-full" />
          <div className="bg-surface-raised relative h-8 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}

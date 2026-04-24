import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { track } from '@/analytics';
import type { Habit, HabitCompletion } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';
import { HabitListItem } from './HabitListItem';
import { SectionHeader } from './SectionHeader';

interface HabitWithStatus {
  habit: Habit;
  completed: boolean;
  streak: number;
}

interface HabitsSectionProps {
  selectedDate: string;
}

export function HabitsSection({ selectedDate }: HabitsSectionProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleAddNote = useCallback(
    (habitName: string) => {
      // Open the journal panel on HomePage via custom event
      window.dispatchEvent(new CustomEvent('toggle-journal'));
      addToast('info', `Add a note for "${habitName}"`);
    },
    [addToast],
  );

  const loadHabits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const ds = await getDataService();
      const allHabits = await ds.getHabits();

      const streakStart = new Date(selectedDate);
      streakStart.setDate(streakStart.getDate() - 30);
      // Use LOCAL date formatting — see fmtLocal() below for rationale.
      const streakStartStr = fmtLocal(streakStart);

      const allCompletions = await ds.getAllCompletions(streakStartStr, selectedDate);

      const completionsByHabit = new Map<string, HabitCompletion[]>();
      for (const c of allCompletions) {
        const existing = completionsByHabit.get(c.habitId) ?? [];
        existing.push(c);
        completionsByHabit.set(c.habitId, existing);
      }

      const withStatus = allHabits.map((habit) => {
        const habitCompletions = completionsByHabit.get(habit.id) ?? [];
        const completed = habitCompletions.some((c) => c.date === selectedDate);
        const streak = calcCurrentStreak(habitCompletions, selectedDate);
        return { habit, completed, streak };
      });

      setHabits(withStatus);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load habits';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  // Refresh when voice commands or other features create/modify habits
  useEffect(() => {
    const handler = () => loadHabits();
    window.addEventListener('habits-changed', handler);
    return () => window.removeEventListener('habits-changed', handler);
  }, [loadHabits]);

  const handleToggle = async (habitId: string, currentlyCompleted: boolean) => {
    if (togglingIds.has(habitId)) return;

    // Optimistic update — flip the UI instantly
    setHabits((prev) =>
      prev.map((h) => (h.habit.id === habitId ? { ...h, completed: !currentlyCompleted } : h)),
    );

    setTogglingIds((prev) => new Set(prev).add(habitId));
    try {
      const ds = await getDataService();
      if (currentlyCompleted) {
        await ds.uncompleteHabit(habitId, selectedDate);
      } else {
        await ds.completeHabit(habitId, selectedDate);
        const target = habits.find((h) => h.habit.id === habitId);
        if (target) {
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
      }
      // Refresh from server to get accurate streak etc.
      await loadHabits();
    } catch (err) {
      // Revert optimistic update on failure
      setHabits((prev) =>
        prev.map((h) => (h.habit.id === habitId ? { ...h, completed: currentlyCompleted } : h)),
      );
      const msg = err instanceof Error ? err.message : 'Failed to toggle habit';
      setError(msg);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
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
            onClick={loadHabits}
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

/** Format Date as YYYY-MM-DD using LOCAL components (NOT UTC). */
function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcCurrentStreak(completions: HabitCompletion[], fromDate: string): number {
  if (completions.length === 0) return 0;

  const dates = [...new Set(completions.map((c) => c.date))].sort().reverse();
  let streak = 0;
  // Construct from local midnight, then format using LOCAL components.
  // Previously toISOString().slice(0,10) returned UTC, which is one day
  // behind LOCAL for users east of UTC (Indonesia, Asia, Australia) —
  // the comparison against `dates` (which are stored in local YYYY-MM-DD)
  // never matched, so streak silently returned 0 for those users.
  const checkDate = new Date(fromDate + 'T00:00:00');

  while (dates.includes(fmtLocal(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

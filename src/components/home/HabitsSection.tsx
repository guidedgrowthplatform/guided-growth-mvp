import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
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
      const streakStartStr = streakStart.toISOString().slice(0, 10);

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

  const handleToggle = async (habitId: string, currentlyCompleted: boolean) => {
    if (togglingIds.has(habitId)) return;

    setTogglingIds((prev) => new Set(prev).add(habitId));
    try {
      const ds = await getDataService();
      if (currentlyCompleted) {
        await ds.uncompleteHabit(habitId, selectedDate);
      } else {
        await ds.completeHabit(habitId, selectedDate);
      }
      await loadHabits();
    } catch (err) {
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
        <p className="text-sm text-content-secondary">Loading habits...</p>
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
        <p className="text-sm text-danger">{error}</p>
        <button onClick={loadHabits} className="mt-2 text-sm font-medium text-primary">
          Retry
        </button>
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
        <p className="text-sm text-content-secondary">No habits yet. Add one to get started!</p>
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

function calcCurrentStreak(completions: HabitCompletion[], fromDate: string): number {
  if (completions.length === 0) return 0;

  const dates = [...new Set(completions.map((c) => c.date))].sort().reverse();
  let streak = 0;
  const checkDate = new Date(fromDate + 'T00:00:00');

  while (dates.includes(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

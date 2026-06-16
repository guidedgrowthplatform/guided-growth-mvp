import { DailyProgressCard } from '@/components/habits/DailyProgressCard';
import { HabitListItem } from '@/components/home/HabitListItem';
import { useHabitsForDate } from '@/hooks/useHabitsForDate';
import { formatFrequency } from '@/lib/utils/formatFrequency';

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Read-only "Today's Habits" snapshot shown in the coach chat after a habit
// completion. Reuses the home-screen progress + list items; live data via
// useHabitsForDate, which already refreshes on the 'habits-changed' event the
// chat fires after complete_habit.
export function HabitReportCard() {
  const { habits } = useHabitsForDate(localToday());
  if (habits.length === 0) return null;

  const completed = habits.filter((h) => h.completed).length;

  return (
    <div className="mb-3 mt-2 flex w-full max-w-[290px] flex-col gap-3">
      <DailyProgressCard completed={completed} total={habits.length} />
      {habits.map((item) => (
        <HabitListItem
          key={item.habit.id}
          name={item.habit.name}
          subtitle={formatFrequency(item.habit.frequency)}
          streak={item.streak}
          status={item.status}
          habitType={item.habit.habitType}
          readOnly
          onSetStatus={() => undefined}
        />
      ))}
    </div>
  );
}

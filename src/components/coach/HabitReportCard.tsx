import { track } from '@/analytics';
import { DailyProgressCard } from '@/components/habits/DailyProgressCard';
import { HabitListItem } from '@/components/home/HabitListItem';
import { useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { useToast } from '@/contexts/ToastContext';
import { useHabitsForDate } from '@/hooks/useHabitsForDate';
import type { HabitDayStatus } from '@/lib/services/data-service.interface';
import { formatFrequency } from '@/lib/utils/formatFrequency';

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function HabitReportCard() {
  const { openScreenId } = useCoachChatLauncher();
  const { addToast } = useToast();
  const { habits, setHabitStatus } = useHabitsForDate(localToday(), openScreenId ?? undefined);
  if (habits.length === 0) return null;

  const completed = habits.filter((h) => h.completed).length;

  const handleSetStatus = async (habitId: string, next: HabitDayStatus) => {
    const target = habits.find((h) => h.habit.id === habitId);
    try {
      await setHabitStatus(habitId, next);
      if (target && next === 'done') {
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
      } else if (target && next === 'missed') {
        track('miss_habit', { habit_name: target.habit.name, current_streak: target.streak });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update habit';
      addToast('error', msg);
    }
  };

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
          onSetStatus={(next) => handleSetStatus(item.habit.id, next)}
        />
      ))}
    </div>
  );
}

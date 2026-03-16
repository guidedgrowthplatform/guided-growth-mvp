import { DaySchedulePills } from '@/components/habit-detail/DaySchedulePills';
import { HabitDetailTopBar, HabitDetailTitle } from '@/components/habit-detail/HabitDetailHeader';
import { MilestonesSection } from '@/components/habit-detail/MilestonesSection';
import { habitDetails } from '@/components/habit-detail/mockHabitDetail';
import { ReflectionCard } from '@/components/habit-detail/ReflectionCard';
import { StatsGrid } from '@/components/habit-detail/StatsGrid';
import { StreakCard } from '@/components/habit-detail/StreakCard';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface HabitDetailPageProps {
  habitId: string;
  onClose: () => void;
}

export function HabitDetailPage({ habitId, onClose }: HabitDetailPageProps) {
  const habit = habitDetails[habitId];

  if (!habit) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-content-secondary">Habit not found.</p>
      </div>
    );
  }

  return (
    <BottomSheet onClose={onClose} topOffset="top-4" showHandle={false}>
      {(close) => (
        <>
          <HabitDetailTopBar onClose={close} />
          <div className="flex flex-col gap-8 px-6 pb-24">
            <HabitDetailTitle name={habit.name} description={habit.description} />
            <DaySchedulePills activeDays={habit.activeDays} frequencyLabel={habit.frequencyLabel} />
            <StreakCard
              currentStreak={habit.currentStreak}
              calendarMonth={habit.calendarMonth}
              totalRepetitions={habit.totalRepetitions}
              sinceDate={habit.sinceDate}
              calendarData={habit.calendarData}
            />
            <StatsGrid
              completionRate={habit.completionRate}
              currentStreak={habit.currentStreak}
              longestStreak={habit.longestStreak}
              failedDays={habit.failedDays}
            />
            <ReflectionCard habitName={habit.name} />
            <MilestonesSection milestones={habit.milestones} />
          </div>
        </>
      )}
    </BottomSheet>
  );
}

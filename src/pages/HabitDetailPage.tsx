import { DaySchedulePills } from '@/components/habit-detail/DaySchedulePills';
import { HabitDetailTopBar, HabitDetailTitle } from '@/components/habit-detail/HabitDetailHeader';
import { MilestonesSection } from '@/components/habit-detail/MilestonesSection';
import { ReflectionCard } from '@/components/habit-detail/ReflectionCard';
import { StatsGrid } from '@/components/habit-detail/StatsGrid';
import { StreakCard } from '@/components/habit-detail/StreakCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useHabitDetail } from '@/hooks/useHabitDetail';

const MILESTONE_TARGETS = [7, 21, 30, 60, 90] as const;

function buildMilestones(totalRepetitions: number) {
  return MILESTONE_TARGETS.map((target) => ({
    target,
    earned: totalRepetitions >= target,
  }));
}

interface HabitDetailPageProps {
  habitId: string;
  onClose: () => void;
}

export function HabitDetailPage({ habitId, onClose }: HabitDetailPageProps) {
  const {
    habit,
    stats,
    calendarMonth,
    calendarData,
    activeDays,
    frequencyLabel,
    isLoading,
    error,
  } = useHabitDetail(habitId);

  if (isLoading) {
    return (
      <BottomSheet onClose={onClose} topOffset="top-4" showHandle={false}>
        {(close) => (
          <>
            <HabitDetailTopBar onClose={close} />
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </>
        )}
      </BottomSheet>
    );
  }

  if (error || !habit) {
    return (
      <BottomSheet onClose={onClose} topOffset="top-4" showHandle={false}>
        {(close) => (
          <>
            <HabitDetailTopBar onClose={close} />
            <div className="flex min-h-[200px] items-center justify-center">
              <p className="text-content-secondary">{error || 'Habit not found.'}</p>
            </div>
          </>
        )}
      </BottomSheet>
    );
  }

  const milestones = buildMilestones(stats.totalRepetitions);

  return (
    <BottomSheet onClose={onClose} topOffset="top-4" showHandle={false}>
      {(close) => (
        <>
          <HabitDetailTopBar onClose={close} />
          <div className="flex flex-col gap-8 px-6 pb-24">
            <HabitDetailTitle name={habit.name} description={`Tracked since ${stats.sinceDate}`} />
            <DaySchedulePills activeDays={activeDays} frequencyLabel={frequencyLabel} />
            <StreakCard
              currentStreak={stats.currentStreak}
              calendarMonth={calendarMonth}
              totalRepetitions={stats.totalRepetitions}
              sinceDate={stats.sinceDate}
              calendarData={calendarData}
            />
            <StatsGrid
              completionRate={stats.completionRate}
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              failedDays={stats.failedDays}
            />
            <ReflectionCard habitName={habit.name} />
            <MilestonesSection milestones={milestones} />
          </div>
        </>
      )}
    </BottomSheet>
  );
}

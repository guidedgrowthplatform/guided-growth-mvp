import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DaySchedulePills } from '@/components/habit-detail/DaySchedulePills';
import { HabitDetailTopBar, HabitDetailTitle } from '@/components/habit-detail/HabitDetailHeader';
import { MilestonesSection } from '@/components/habit-detail/MilestonesSection';
import { ReflectionCard } from '@/components/habit-detail/ReflectionCard';
import { StatsGrid } from '@/components/habit-detail/StatsGrid';
import { StreakCard } from '@/components/habit-detail/StreakCard';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useHabitDetail } from '@/hooks/useHabitDetail';
import { speak } from '@/lib/services/tts-service';

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
  const navigate = useNavigate();
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

  const handleLogReflection = useCallback(() => {
    onClose();
    navigate('/home');
    // Open journal panel after navigation settles
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('toggle-journal'));
    }, 100);
  }, [onClose, navigate]);

  // TTS milestone celebration per Voice Journey Spreadsheet v3 (line 454-458)
  const hasSpokenMilestone = useRef(false);
  useEffect(() => {
    if (hasSpokenMilestone.current || !stats || isLoading) return;
    hasSpokenMilestone.current = true;
    const reps = stats.totalRepetitions;
    if (reps >= 90) {
      speak("90 days. This isn't a habit anymore \u2014 this is who you are.");
    } else if (reps >= 60) {
      speak("60 days. You've built something real here.");
    } else if (reps >= 30) {
      speak("30 days. This started as something you were trying. Now it's something you do. That's a real shift.");
    } else if (reps >= 21) {
      speak("21 days in. You're building something lasting.");
    } else if (reps >= 7) {
      speak("One week. You showed up seven days in a row. That's not luck \u2014 that's you.");
    }
  }, [stats, isLoading]);

  if (isLoading) {
    return (
      <BottomSheet
        onClose={onClose}
        topOffset="top-[max(1rem,env(safe-area-inset-top))]"
        showHandle={false}
      >
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
      <BottomSheet
        onClose={onClose}
        topOffset="top-[max(1rem,env(safe-area-inset-top))]"
        showHandle={false}
      >
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
    <BottomSheet
      onClose={onClose}
      topOffset="top-[max(1rem,env(safe-area-inset-top))]"
      showHandle={false}
    >
      {(close) => (
        <>
          <HabitDetailTopBar onClose={close} />
          <div className="flex flex-col gap-5 px-6 pb-6">
            <div className="flex flex-col gap-3">
              <HabitDetailTitle
                name={habit.name}
                description={`Tracked since ${stats.sinceDate}`}
              />
              <DaySchedulePills activeDays={activeDays} frequencyLabel={frequencyLabel} />
            </div>
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
            <ReflectionCard habitName={habit.name} onLogReflection={handleLogReflection} />
            <MilestonesSection milestones={milestones} />
          </div>
        </>
      )}
    </BottomSheet>
  );
}

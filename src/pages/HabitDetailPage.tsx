import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DaySchedulePills } from '@/components/habit-detail/DaySchedulePills';
import { HabitDetailTopBar, HabitDetailTitle } from '@/components/habit-detail/HabitDetailHeader';
import { MilestonesSection } from '@/components/habit-detail/MilestonesSection';
import { habitDetails } from '@/components/habit-detail/mockHabitDetail';
import { ReflectionCard } from '@/components/habit-detail/ReflectionCard';
import { StatsGrid } from '@/components/habit-detail/StatsGrid';
import { StreakCard } from '@/components/habit-detail/StreakCard';

export function HabitDetailPage() {
  const { habitId } = useParams<{ habitId: string }>();
  const navigate = useNavigate();
  const habit = habitId ? habitDetails[habitId] : undefined;

  const [phase, setPhase] = useState<'entering' | 'open' | 'exiting'>('entering');

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = useCallback(() => {
    setPhase('exiting');
  }, []);

  const handleTransitionEnd = useCallback(() => {
    if (phase === 'exiting') {
      navigate(-1);
    }
  }, [phase, navigate]);

  if (!habit) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-content-secondary">Habit not found.</p>
      </div>
    );
  }

  const isVisible = phase === 'open';

  return (
    <div className="fixed inset-0 z-30">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ease-out ${
          isVisible ? 'opacity-40' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div className="absolute inset-0 mx-auto max-w-sm">
        <div
          className={`absolute inset-x-0 bottom-0 top-4 flex flex-col overflow-hidden rounded-t-3xl bg-white transition-transform duration-300 ease-out ${
            isVisible ? 'translate-y-0' : 'translate-y-full'
          }`}
          onTransitionEnd={handleTransitionEnd}
        >
          <HabitDetailTopBar onClose={handleClose} />
          <div className="flex flex-col gap-8 overflow-y-auto px-6 pb-24">
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
        </div>
      </div>
    </div>
  );
}

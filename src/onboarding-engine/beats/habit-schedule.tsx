import { useState } from 'react';
import { WEEKDAYS, toggleSetItem } from '@/components/onboarding/constants';
import { HabitScheduleCard, type HabitPolarity } from '@/components/onboarding/HabitScheduleCard';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { DEFAULT_SCHEDULE_HABITS, Surface } from './_shared';

export default function HabitSchedulePreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  const componentProps = (beat.component.props ?? {}) as { habits?: string[] };
  const componentConfig = beat.component.config ?? {};
  const habits = componentProps.habits?.length ? componentProps.habits : DEFAULT_SCHEDULE_HABITS;
  const [schedules, setSchedules] = useState<
    Record<string, { days: Set<number>; polarity: HabitPolarity }>
  >(() =>
    Object.fromEntries(
      habits.map((habit) => [
        habit,
        { days: new Set(WEEKDAYS), polarity: 'build' as HabitPolarity },
      ]),
    ),
  );

  function updateSchedule(
    habit: string,
    update: Partial<{ days: Set<number>; polarity: HabitPolarity }>,
  ) {
    setSchedules((current) => ({ ...current, [habit]: { ...current[habit], ...update } }));
  }

  return (
    <Surface beat={beat}>
      <div data-testid="habit-schedule-preview-real" style={{ minHeight: 312, marginTop: 12 }}>
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <div className="flex flex-col gap-4">
          {habits.map((habit) => {
            const schedule = schedules[habit];
            return (
              <HabitScheduleCard
                key={habit}
                habitName={habit}
                polarity={schedule.polarity}
                selectedDays={schedule.days}
                onChangePolarity={(polarity) => updateSchedule(habit, { polarity })}
                onToggleDay={(day) =>
                  updateSchedule(habit, { days: toggleSetItem(schedule.days, day) })
                }
                onEdit={() => {}}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={onAdvance}
          className="mt-4 w-full rounded-[24px] bg-primary px-[16px] py-[14px] text-[16px] font-bold leading-[24px] text-white"
        >
          Continue
        </button>
      </div>
    </Surface>
  );
}

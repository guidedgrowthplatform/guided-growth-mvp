import { useState } from 'react';
import { HabitPickerPanel } from '@/components/onboarding/HabitPickerPanel';
import { Orb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import { habitsByGoal, MAX_HABITS_ONBOARDING } from '@/data/onboardingHabits';
import type { OnboardingBeat } from '@/generated/onboardingContract';
import { Surface } from './_shared';

export default function HabitPickerPreview({
  beat,
  onAdvance,
}: {
  beat: OnboardingBeat;
  onAdvance: () => void;
}) {
  const componentProps = (beat.component.props ?? {}) as { goal?: string };
  const componentConfig = beat.component.config ?? {};
  const goal = componentProps.goal ?? 'Fall asleep earlier';
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(() => new Set());
  const [customHabits, setCustomHabits] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(true);
  const habits = [...(habitsByGoal[goal] ?? []), ...customHabits];
  const maxReached = selectedHabits.size >= MAX_HABITS_ONBOARDING;

  function toggleHabit(habit: string) {
    setSelectedHabits((current) => {
      const next = new Set(current);
      if (next.has(habit)) next.delete(habit);
      else if (next.size < MAX_HABITS_ONBOARDING) next.add(habit);
      return next;
    });
  }

  function addCustomHabit(habit: string) {
    setCustomHabits((current) => [...current, habit]);
    setSelectedHabits((current) => new Set(current).add(habit));
  }

  return (
    <Surface beat={beat}>
      <div data-testid="habit-picker-preview-real" style={{ minHeight: 312, marginTop: 12 }}>
        {componentConfig.hideOrb !== true && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Orb {...orbIdle(48, true, true, { frozen: true })} />
          </div>
        )}
        <HabitPickerPanel
          goal={goal}
          habits={habits}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((current) => !current)}
          selectedHabits={selectedHabits}
          maxReached={maxReached}
          onToggleHabit={toggleHabit}
          onAddCustomHabit={addCustomHabit}
        />
        <button
          type="button"
          onClick={onAdvance}
          disabled={selectedHabits.size === 0}
          className="mt-4 w-full rounded-[24px] bg-primary px-[16px] py-[14px] text-[16px] font-bold leading-[24px] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </Surface>
  );
}

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { GoalCard } from '@/components/onboarding/GoalCard';

interface HabitPickerPanelProps {
  goals: string[];
  activeGoal: string;
  onChangeGoal: (goal: string) => void;
  habits: string[];
  selectedHabits: Set<string>;
  onToggleHabit: (habit: string) => void;
}

export function HabitPickerPanel({
  goals,
  activeGoal,
  onChangeGoal,
  habits,
  selectedHabits,
  onToggleHabit,
}: HabitPickerPanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const hasMultipleGoals = goals.length > 1;

  return (
    <div className="rounded-[20px] border-2 border-[#135bec] bg-[#eff6ff] p-[22px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      {/* Goal dropdown header */}
      {hasMultipleGoals ? (
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex w-full cursor-pointer items-center justify-between"
        >
          <span className="pl-[12px] text-[18px] font-bold leading-[28px] text-[#1a202c]">
            {activeGoal}
          </span>
          <Icon
            icon="icon-park-outline:down"
            width={24}
            height={24}
            className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>
      ) : (
        <div className="flex w-full items-center">
          <span className="pl-[12px] text-[18px] font-bold leading-[28px] text-[#1a202c]">
            {activeGoal}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="mt-[8px] flex flex-col gap-[4px]">
          {goals
            .filter((g) => g !== activeGoal)
            .map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  onChangeGoal(g);
                  setDropdownOpen(false);
                }}
                className="w-full cursor-pointer rounded-[12px] px-[12px] py-[8px] text-left text-[16px] font-medium text-[#1a202c] hover:bg-[#dbeafe]"
              >
                {g}
              </button>
            ))}
        </div>
      )}

      {/* Separator */}
      <div className="my-[16px] w-full border-t border-[#e2e8f0]" />

      {/* Section label */}
      <p className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-[#718096]">
        Habit List
      </p>

      {/* Habit cards */}
      <div className="mt-[16px] flex flex-col gap-[12px]">
        {habits.map((h) => (
          <GoalCard
            key={h}
            label={h}
            selected={selectedHabits.has(h)}
            onToggle={() => onToggleHabit(h)}
          />
        ))}
      </div>
    </div>
  );
}

import { Icon } from '@iconify/react';
import { useRef, useEffect, useState } from 'react';
import { GoalCard } from './GoalCard';

interface HabitPickerPanelProps {
  goal: string;
  habits: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedHabits: Set<string>;
  onToggleHabit: (habit: string) => void;
}

export function HabitPickerPanel({
  goal,
  habits,
  expanded,
  onToggleExpanded,
  selectedHabits,
  onToggleHabit,
}: HabitPickerPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, habits, selectedHabits]);

  return (
    <div className="rounded-[20px] border-2 border-primary bg-[#eff6ff] px-[22px] py-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full cursor-pointer items-center justify-between focus:outline-none"
      >
        <span className="pl-[12px] text-[18px] font-bold leading-[28px] text-[#1a202c]">
          {goal}
        </span>
        <Icon
          icon="icon-park-outline:down"
          width={24}
          height={24}
          className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        style={{ maxHeight: expanded ? height : 0 }}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      >
        <div ref={contentRef}>
          <div className="my-[16px] w-full border-t border-[#e2e8f0]" />

          <p className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-[#718096]">
            Habit List
          </p>

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
      </div>
    </div>
  );
}

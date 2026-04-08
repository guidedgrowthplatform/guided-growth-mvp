import { Icon } from '@iconify/react';
import { useRef, useEffect, useState } from 'react';
import { GoalCard } from './GoalCard';

interface HabitPickerPanelProps {
  goal: string;
  habits: string[];
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedHabits: Set<string>;
  maxReached?: boolean;
  onToggleHabit: (habit: string) => void;
  onAddCustomHabit?: (habit: string) => void;
}

export function HabitPickerPanel({
  goal,
  habits,
  expanded,
  onToggleExpanded,
  selectedHabits,
  maxReached,
  onToggleHabit,
  onAddCustomHabit,
}: HabitPickerPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showInput, setShowInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  const isDisabled = (h: string) => !selectedHabits.has(h) && !!maxReached;

  function handleCreateClick() {
    if (maxReached) return;
    setShowInput(true);
  }

  function handleSubmitCustom() {
    const trimmed = customValue.trim();
    if (!trimmed || !onAddCustomHabit) return;
    if (habits.some((h) => h.toLowerCase() === trimmed.toLowerCase())) return;
    onAddCustomHabit(trimmed);
    setCustomValue('');
    setShowInput(false);
  }

  return (
    <div className="rounded-[20px] border-2 border-primary bg-primary/5 px-[22px] py-[26px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full cursor-pointer items-center justify-between focus:outline-none"
      >
        <span className="pl-[12px] text-[18px] font-bold leading-[28px] text-content">{goal}</span>
        <Icon
          icon="icon-park-outline:down"
          width={24}
          height={24}
          className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="my-[16px] w-full border-t border-border" />

          <p className="text-[14px] font-semibold uppercase leading-[20px] tracking-[0.7px] text-content-secondary">
            Habit List
          </p>

          <div className="mt-[16px] flex flex-col gap-[12px]">
            {habits.map((h) => (
              <GoalCard
                key={h}
                label={h}
                selected={selectedHabits.has(h)}
                disabled={isDisabled(h)}
                onToggle={() => onToggleHabit(h)}
              />
            ))}

            {showInput ? (
              <div className="flex items-center gap-2 rounded-[24px] border border-primary bg-surface px-[16px] py-[10px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
                <input
                  ref={inputRef}
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitCustom()}
                  placeholder="Type your habit..."
                  className="flex-1 text-[16px] font-bold leading-[24px] text-content outline-none placeholder:font-normal placeholder:text-content-secondary/50"
                />
                <button
                  type="button"
                  onClick={handleSubmitCustom}
                  disabled={!customValue.trim()}
                  className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-primary transition-opacity disabled:opacity-30"
                >
                  <Icon icon="mdi:check" width={18} height={18} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCreateClick}
                className={`flex w-full items-center justify-between rounded-[24px] border bg-surface px-[16px] py-[14px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)] transition-all duration-200 ${
                  maxReached ? 'border-transparent opacity-40' : 'cursor-pointer border-border'
                }`}
              >
                <span className="text-[16px] font-bold leading-[24px] text-content">
                  Create your own habit!
                </span>
                <div className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-warning">
                  <Icon icon="mdi:plus" width={18} height={18} className="text-white" />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

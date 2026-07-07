import { Icon } from '@iconify/react';
import { useState } from 'react';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
import { DEFAULT_REFLECTION_PROMPTS } from '@gg/shared/types';
import { SECTION_LABEL_CLASS } from './constants';

interface DailyReflectionCardProps {
  time: string;
  onTimeChange: (time: string) => void;
  days: Set<number>;
  onToggleDay: (day: number) => void;
  reminder: boolean;
  onToggleReminder: (value: boolean) => void;
  onCreatePrompts?: () => void;
  prompts?: string[];
  selectedPrompts?: string[];
  onTogglePrompt?: (prompt: string) => void;
  // 'schedule' drops the reflection header + questions, leaving only the
  // schedule/when/how-often/reminder editor (reused by the habit-schedule and
  // morning-checkin beats, which only need the cadence chrome).
  variant?: 'reflection' | 'schedule';
  title?: string;
  subtitle?: string;
}

export function DailyReflectionCard({
  time,
  onTimeChange,
  days,
  onToggleDay,
  reminder,
  onToggleReminder,
  onCreatePrompts,
  prompts,
  selectedPrompts,
  onTogglePrompt,
  variant = 'reflection',
  title,
  subtitle,
}: DailyReflectionCardProps) {
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const questions = prompts ?? DEFAULT_REFLECTION_PROMPTS;
  const isSelected = (q: string) => !selectedPrompts || selectedPrompts.includes(q);
  const selectedCount = questions.filter(isSelected).length;
  const isSchedule = variant === 'schedule';
  const headerTitle = isSchedule ? (title ?? 'Schedule') : 'Daily Reflection';
  const headerSubtitle = isSchedule
    ? subtitle
    : `${selectedCount} quick question${selectedCount === 1 ? '' : 's'} before bed`;

  return (
    <>
      <div className="flex w-full flex-col gap-[24px] rounded-[24px] border border-border-light bg-surface p-[25px] shadow-[0px_10px_30px_-5px_rgba(19,91,236,0.08),0px_4px_12px_-4px_rgba(0,0,0,0.03)]">
        {/* Header */}
        <div className="flex items-center gap-[16px]">
          <div className="flex size-[48px] items-center justify-center rounded-[24px] bg-primary/10">
            <Icon
              icon={isSchedule ? 'ic:round-event-available' : 'ic:round-menu-book'}
              className="size-[24px] text-primary"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-bold text-content">{headerTitle}</span>
            {headerSubtitle && (
              <span className="text-[14px] font-medium text-content-tertiary">
                {headerSubtitle}
              </span>
            )}
          </div>
        </div>

        {!isSchedule && (
          <>
            {/* Questions — tappable, selected = solid, deselected = faded */}
            <div className="flex flex-col gap-[12px]">
              <span className="text-[14px] font-bold uppercase tracking-[0.35px] text-content-secondary">
                You'll answer {selectedCount} quick question{selectedCount === 1 ? '' : 's'}:
              </span>
              {questions.map((q) => {
                const selected = isSelected(q);
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onTogglePrompt?.(q)}
                    disabled={!onTogglePrompt}
                    className={`w-full rounded-[16px] bg-surface-secondary px-[16px] py-[14px] text-left text-[16px] font-medium transition-opacity ${
                      selected ? 'text-content' : 'text-content-tertiary opacity-50'
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>

            {onCreatePrompts && (
              <button
                type="button"
                onClick={onCreatePrompts}
                className="w-full rounded-full border-2 border-primary py-[14px] text-center text-[16px] font-bold text-primary"
              >
                Optional: Create My Own Prompts
              </button>
            )}

            {/* Divider */}
            <div className="h-px w-full bg-border-light" />
          </>
        )}

        {/* When? — full-width clickable row */}
        <div className="flex flex-col gap-[16px]">
          <span className={SECTION_LABEL_CLASS}>When?</span>
          <button
            type="button"
            onClick={() => setTimePickerOpen(true)}
            className="flex w-full items-center justify-between rounded-[24px] border border-primary bg-surface px-[21px] py-[15px]"
          >
            <span className="text-[15px] font-bold text-content">{formatTime12(time)}</span>
            <Icon icon="ic:round-access-time" className="size-[20px] text-primary" />
          </button>
        </div>

        {/* How often? */}
        <div className="flex flex-col gap-[16px]">
          <span className={SECTION_LABEL_CLASS}>How often?</span>
          <DayPicker selectedDays={days} onToggleDay={onToggleDay} />
        </div>

        {/* Reminder */}
        <div className="flex items-center justify-between py-[8px]">
          <span className={SECTION_LABEL_CLASS}>Reminder</span>
          <Toggle checked={reminder} onChange={onToggleReminder} />
        </div>
      </div>

      {timePickerOpen && (
        <TimePickerSheet
          value={time}
          onChange={onTimeChange}
          onClose={() => setTimePickerOpen(false)}
        />
      )}
    </>
  );
}

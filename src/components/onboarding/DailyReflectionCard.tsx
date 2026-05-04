import { Icon } from '@iconify/react';
import { useState } from 'react';
import { DayPicker } from '@/components/ui/DayPicker';
import { TimePickerSheet } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
import { formatTime12 } from '@/lib/utils/time';
import { SECTION_LABEL_CLASS } from './constants';
import { SchedulePicker, type ScheduleOption } from './SchedulePicker';

interface DailyReflectionCardProps {
  time: string;
  onTimeChange: (time: string) => void;
  days: Set<number>;
  onToggleDay: (day: number) => void;
  reminder: boolean;
  onToggleReminder: (value: boolean) => void;
  schedule: ScheduleOption;
  onScheduleChange: (value: ScheduleOption) => void;
}

const QUESTIONS = [
  'What am I proud of today?',
  'What do I forgive myself for today?',
  'What am I grateful for today?',
];

export function DailyReflectionCard({
  time,
  onTimeChange,
  days,
  onToggleDay,
  reminder,
  onToggleReminder,
  schedule,
  onScheduleChange,
}: DailyReflectionCardProps) {
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  return (
    <>
      <div className="flex w-full flex-col gap-[24px] rounded-[24px] border border-border-light bg-surface-secondary p-[25px] shadow-[0px_10px_30px_-5px_rgba(19,91,236,0.08),0px_4px_12px_-4px_rgba(0,0,0,0.03)]">
        {/* Header */}
        <div className="flex items-center gap-[16px]">
          <div className="flex size-[48px] items-center justify-center rounded-[24px] bg-primary/10">
            <Icon icon="ic:round-menu-book" className="size-[24px] text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-bold text-content">Daily Reflection</span>
            <span className="text-[14px] font-medium text-content-tertiary">
              3 quick questions before bed
            </span>
          </div>
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-[12px]">
          <span className="text-[14px] font-bold uppercase tracking-[0.35px] text-content">
            You'll answer 3 quick questions:
          </span>
          {QUESTIONS.map((q) => (
            <div key={q} className="flex items-center gap-[8px]">
              <Icon icon="ic:outline-check-circle" className="size-[17px] shrink-0 text-primary" />
              <span className="text-[16px] font-medium text-content-subtle">{q}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border-light" />

        {/* Schedule */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-content-secondary">Schedule:</span>
          <SchedulePicker value={schedule} onChange={onScheduleChange} />
        </div>

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

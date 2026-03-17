import { Icon } from '@iconify/react';
import { TimePicker } from '@/components/ui/TimePicker';
import { SECTION_LABEL_CLASS } from './constants';
import { DayPicker } from './DayPicker';
import { SchedulePicker, type ScheduleOption } from './SchedulePicker';
import { ToggleSwitch } from './ToggleSwitch';

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
  return (
    <div className="flex w-full flex-col gap-[24px] rounded-[24px] border border-[#f1f5f9] bg-white p-[25px] shadow-[0px_10px_30px_-5px_rgba(19,91,236,0.08),0px_4px_12px_-4px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="flex items-center gap-[16px]">
        <div className="flex size-[48px] items-center justify-center rounded-[24px] bg-[rgba(19,91,236,0.1)]">
          <Icon icon="ic:round-menu-book" className="size-[24px] text-[#135bec]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[18px] font-bold text-[#0f172a]">Daily Reflection</span>
          <span className="text-[14px] font-medium text-[#94a3b8]">
            3 quick questions before bed
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-[12px]">
        <span className="text-[14px] font-bold uppercase tracking-[0.35px] text-[#0f172a]">
          You'll answer 3 quick questions:
        </span>
        {QUESTIONS.map((q) => (
          <div key={q} className="flex items-center gap-[8px]">
            <Icon icon="ic:outline-check-circle" className="size-[17px] shrink-0 text-[#135bec]" />
            <span className="text-[16px] font-medium text-[#475569]">{q}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-[#f1f5f9]" />

      {/* Schedule */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[#64748b]">Schedule:</span>
        <SchedulePicker value={schedule} onChange={onScheduleChange} />
      </div>

      {/* When? */}
      <div className="flex flex-col gap-[16px]">
        <span className={SECTION_LABEL_CLASS}>When?</span>
        <div className="flex w-full items-center justify-between rounded-[24px] border border-[#135bec] bg-[#eff6ff] px-[21px] py-[15px]">
          <TimePicker value={time} onChange={onTimeChange} />
          <Icon icon="ic:round-access-time" className="size-[20px] text-[#135bec]" />
        </div>
      </div>

      {/* How often? */}
      <div className="flex flex-col gap-[16px]">
        <span className={SECTION_LABEL_CLASS}>How often?</span>
        <DayPicker selectedDays={days} onToggleDay={onToggleDay} />
      </div>

      {/* Reminder */}
      <div className="flex items-center justify-between py-[8px]">
        <span className={SECTION_LABEL_CLASS}>Reminder</span>
        <ToggleSwitch checked={reminder} onChange={onToggleReminder} />
      </div>
    </div>
  );
}

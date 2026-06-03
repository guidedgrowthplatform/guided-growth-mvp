import { Icon } from '@iconify/react';
import { useState } from 'react';
import { SchedulePicker, type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
import {
  inferSchedule,
  SCHEDULE_DAYS,
  SECTION_LABEL_CLASS,
  toggleSetItem,
  WEEKDAYS,
} from './constants';

export interface HabitConfig {
  time: string;
  days: Set<number>;
  reminder: boolean;
  schedule: ScheduleOption;
}

interface HabitCustomizeSheetProps {
  habitName: string;
  onClose: () => void;
  onNext: (config: HabitConfig) => void;
  isLastHabit: boolean;
}

export function HabitCustomizeSheet({
  habitName,
  onClose,
  onNext,
  isLastHabit,
}: HabitCustomizeSheetProps) {
  // Schedule and days are kept reconciled: picking a chip narrows days,
  // toggling a day re-infers the chip label. PlanReviewPage can then read
  // formatCadence(days) alone and get a faithful cadence.
  const [time, setTime] = useState('21:45');
  const [days, setDays] = useState<Set<number>>(new Set(WEEKDAYS));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Weekday');
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  function handleScheduleChange(value: ScheduleOption) {
    setSchedule(value);
    setDays(new Set(SCHEDULE_DAYS[value]));
  }

  function handleToggleDay(day: number) {
    setDays((prev) => {
      const next = toggleSetItem(prev, day);
      setSchedule(inferSchedule(next) ?? 'Weekday');
      return next;
    });
  }

  function handleSubmit() {
    onNext({ time, days: new Set(days), reminder, schedule });
  }

  return (
    <>
      <div className="flex flex-col gap-[32px] px-6 pb-[calc(120px+24px+env(safe-area-inset-bottom))] pt-[32px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-[4px]">
            <h3 className="text-[16px] font-bold leading-[24px] text-content">{habitName}</h3>
            <p className="text-[14px] font-medium leading-[22px] tracking-[0.21px] text-content-secondary">
              Customize your habit
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-[44px] items-center justify-center rounded-full bg-border-light"
          >
            <Icon icon="ic:round-close" className="size-[24px] text-content" />
          </button>
        </div>

        {/* WHEN — full-width clickable row */}
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

        {/* SCHEDULE */}
        <div className="flex items-center justify-between">
          <span className={SECTION_LABEL_CLASS}>Schedule</span>
          <SchedulePicker value={schedule} onChange={handleScheduleChange} />
        </div>

        {/* HOW OFTEN */}
        <div className="flex flex-col gap-[16px]">
          <span className={SECTION_LABEL_CLASS}>How often?</span>
          <DayPicker selectedDays={days} onToggleDay={handleToggleDay} />
        </div>

        {/* REMINDER */}
        <div className="flex items-center justify-between py-[8px]">
          <span className={SECTION_LABEL_CLASS}>Reminder</span>
          <Toggle checked={reminder} onChange={setReminder} />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="h-[56px] w-full rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          {isLastHabit ? 'Continue' : 'Next Habit'}
        </button>
      </div>

      {timePickerOpen && (
        <TimePickerSheet value={time} onChange={setTime} onClose={() => setTimePickerOpen(false)} />
      )}
    </>
  );
}

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { Toggle } from '@/components/ui/Toggle';
import { SchedulePicker, type ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { ALL_DAYS, SECTION_LABEL_CLASS, toggleSetItem } from './constants';

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
  const [time, setTime] = useState('21:45');
  const [days, setDays] = useState<Set<number>>(new Set(ALL_DAYS));
  const [reminder, setReminder] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleOption>('Weekday');
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  function handleSubmit() {
    onNext({ time, days: new Set(days), reminder, schedule });
  }

  return (
    <>
      <div className="flex flex-col gap-[32px] px-6 pb-[40px] pt-[32px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-[4px]">
            <h3 className="text-[16px] font-bold leading-[24px] text-content">{habitName}</h3>
            <p className="text-[14px] font-medium leading-[22px] tracking-[0.21px] text-content-secondary">
              Customize your habit
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-border-light p-[8px]">
            <Icon icon="ic:round-close" className="size-[14px] text-content" />
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
          <SchedulePicker value={schedule} onChange={setSchedule} />
        </div>

        {/* HOW OFTEN */}
        <div className="flex flex-col gap-[16px]">
          <span className={SECTION_LABEL_CLASS}>How often?</span>
          <DayPicker
            selectedDays={days}
            onToggleDay={(day) => setDays((prev) => toggleSetItem(prev, day))}
          />
        </div>

        {/* REMINDER */}
        <div className="flex items-center justify-between py-[8px]">
          <span className={SECTION_LABEL_CLASS}>Reminder</span>
          <Toggle checked={reminder} onChange={setReminder} />
        </div>

        <div className="flex gap-[8px]">
          <button
            type="button"
            onClick={handleSubmit}
            className="h-[56px] flex-1 rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
          >
            {isLastHabit ? 'Continue' : 'Next Habit'}
          </button>
          <button
            type="button"
            className="flex size-[56px] items-center justify-center rounded-full bg-primary shadow-[0px_25px_50px_-12px_rgba(19,91,236,0.4)]"
          >
            <Icon icon="ic:round-mic" className="h-[22px] w-[22px] text-white" />
          </button>
        </div>
      </div>

      {timePickerOpen && (
        <TimePickerSheet value={time} onChange={setTime} onClose={() => setTimePickerOpen(false)} />
      )}
    </>
  );
}

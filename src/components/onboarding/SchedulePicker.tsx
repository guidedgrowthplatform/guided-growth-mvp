import { Icon } from '@iconify/react';
import { useState, useRef, useEffect } from 'react';

const SCHEDULE_OPTIONS = ['Weekday', 'Weekend', 'Every day'] as const;
type ScheduleOption = (typeof SCHEDULE_OPTIONS)[number];

interface SchedulePickerProps {
  value: ScheduleOption;
  onChange: (value: ScheduleOption) => void;
}

export type { ScheduleOption };

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[4px] rounded-full bg-border-light px-[16px] py-[8px]"
      >
        <span className="text-[14px] font-bold text-content-subtle">{value}</span>
        <Icon
          icon="ic:round-keyboard-arrow-down"
          className={`size-[18px] text-content-subtle transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[60] mt-[4px] overflow-hidden rounded-[16px] border border-border-light bg-surface-secondary shadow-[0px_10px_30px_-5px_rgba(0,0,0,0.15)]">
          {SCHEDULE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`flex w-full items-center px-[20px] py-[12px] text-[14px] font-semibold transition-colors ${
                option === value
                  ? 'bg-primary/10 text-primary'
                  : 'text-content-subtle hover:bg-surface'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

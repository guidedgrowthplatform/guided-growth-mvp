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
        className="flex items-center gap-[4px] rounded-full bg-[#f1f5f9] px-[16px] py-[8px]"
      >
        <span className="text-[14px] font-bold text-[#334155]">{value}</span>
        <Icon
          icon="ic:round-keyboard-arrow-down"
          className={`size-[18px] text-[#334155] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-[4px] overflow-hidden rounded-[16px] border border-[#f1f5f9] bg-white shadow-[0px_10px_30px_-5px_rgba(0,0,0,0.1)]">
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
                  ? 'bg-[#eff6ff] text-[#135bec]'
                  : 'text-[#334155] hover:bg-[#f8fafc]'
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

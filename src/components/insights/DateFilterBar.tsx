import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { availableMonths } from './insightsMockData';

export function DateFilterBar() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(availableMonths[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-[#f3f4f6] bg-surface px-[17px] py-[13px] shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)] transition-colors active:bg-[#f9fafb]"
      >
        <div className="flex items-center gap-3">
          <Icon
            icon="mdi:calendar-blank-outline"
            width={20}
            height={20}
            className="text-content-secondary"
          />
          <span className="text-[14px] font-bold leading-5 text-content-subtle">{selected}</span>
        </div>
        <Icon
          icon="mdi:chevron-down"
          width={16}
          height={16}
          className={`text-content-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select month"
          className="absolute left-0 right-0 top-full z-20 mt-1 animate-slide-up rounded-lg border border-border-light bg-surface py-1 shadow-elevated"
        >
          {availableMonths.map((month) => (
            <button
              key={month}
              role="option"
              aria-selected={month === selected}
              onClick={() => {
                setSelected(month);
                setOpen(false);
              }}
              className={`w-full px-[17px] py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-[#f8fafc] ${
                month === selected ? 'font-bold text-primary' : 'text-content-subtle'
              }`}
            >
              {month}
              {month === selected && (
                <Icon
                  icon="mdi:check"
                  width={16}
                  height={16}
                  className="ml-2 inline text-primary"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

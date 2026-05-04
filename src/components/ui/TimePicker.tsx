import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { formatTime12 } from '@/lib/utils/time';

// ── Helpers ──────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS = ['AM', 'PM'] as const;
const ITEM_HEIGHT = 44;

function parse24(time24: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const [h24, m] = time24.split(':').map(Number);
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 || 12;
  const snapped = Math.round(m / 5) * 5;
  return { hour: hour12, minute: snapped >= 60 ? 55 : snapped, period };
}

function to24(hour: number, minute: number, period: string): string {
  let h = hour;
  if (period === 'AM' && h === 12) h = 0;
  else if (period === 'PM' && h !== 12) h += 12;
  return `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ── ScrollColumn ─────────────────────────────────────────

interface ScrollColumnProps<T extends number | string> {
  items: readonly T[];
  selected: T;
  onChange: (item: T) => void;
  format?: (item: T) => string;
}

function ScrollColumn<T extends number | string>({
  items,
  selected,
  onChange,
  format,
}: ScrollColumnProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScroll = useRef(true);

  const selectedIndex = items.indexOf(selected);

  // scroll to selected on mount and when selected changes programmatically
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    isUserScroll.current = false;
    el.scrollTo({ top: selectedIndex * ITEM_HEIGHT, behavior: 'smooth' });
    const timer = setTimeout(() => {
      isUserScroll.current = true;
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !isUserScroll.current) return;

    const index = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    if (items[clamped] !== selected) {
      onChange(items[clamped]);
    }
  }, [items, selected, onChange]);

  // snap on scroll end
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    [],
  );

  const onScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      handleScroll();
      // snap
      const el = containerRef.current;
      if (el) {
        const index = Math.round(el.scrollTop / ITEM_HEIGHT);
        isUserScroll.current = false;
        el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
        setTimeout(() => {
          isUserScroll.current = true;
        }, 300);
      }
    }, 80);
  }, [handleScroll]);

  const display = (item: T) => (format ? format(item) : String(item));

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="scrollbar-hidden relative flex-1 overflow-y-auto"
      style={{ height: ITEM_HEIGHT * 5 }}
    >
      {/* top/bottom padding so items can center */}
      <div style={{ height: ITEM_HEIGHT * 2 }} />
      {items.map((item) => {
        const isSelected = item === selected;
        return (
          <button
            key={String(item)}
            onClick={() => onChange(item)}
            className={`flex w-full items-center justify-center text-lg transition-all ${
              isSelected ? 'font-bold text-primary' : 'font-medium text-content-tertiary'
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {display(item)}
          </button>
        );
      })}
      <div style={{ height: ITEM_HEIGHT * 2 }} />
    </div>
  );
}

// ── TimePickerSheet (the bottom-sheet picker) ────────────

interface TimePickerSheetProps {
  value: string;
  onChange: (time24: string) => void;
  onClose: () => void;
}

export function TimePickerSheet({ value, onChange, onClose }: TimePickerSheetProps) {
  const parsed = parse24(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);

  const handleDone = () => {
    onChange(to24(hour, minute, period));
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} showHandle={false}>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <button onClick={onClose} className="text-base font-semibold text-content-secondary">
            Cancel
          </button>
          <span className="text-lg font-bold text-content">Set Time</span>
          <button onClick={handleDone} className="text-base font-bold text-primary">
            Done
          </button>
        </div>

        {/* Drum roller */}
        <div className="relative flex items-center px-6 py-4">
          {/* Selection highlight bar */}
          <div
            className="pointer-events-none absolute inset-x-6 rounded-xl bg-primary-bg"
            style={{ height: ITEM_HEIGHT, top: '50%', transform: 'translateY(-50%)' }}
          />

          <ScrollColumn
            items={HOURS}
            selected={hour}
            onChange={setHour}
            format={(h) => h.toString().padStart(2, '0')}
          />

          <span className="z-10 text-2xl font-bold text-content">:</span>

          <ScrollColumn
            items={MINUTES}
            selected={minute}
            onChange={setMinute}
            format={(m) => m.toString().padStart(2, '0')}
          />

          <ScrollColumn items={PERIODS} selected={period} onChange={setPeriod} />
        </div>
      </div>
    </BottomSheet>
  );
}

// ── TimePicker (the trigger pill) ────────────────────────

interface TimePickerProps {
  value: string;
  onChange: (time24: string) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex items-center gap-1 rounded-full bg-[#fffbeb] px-4 py-2"
        onClick={() => setOpen(true)}
      >
        <span className="text-sm font-bold text-slate-700">{formatTime12(value)}</span>
        <ChevronDown className="h-4 w-4 text-slate-700" />
      </button>

      {open && <TimePickerSheet value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

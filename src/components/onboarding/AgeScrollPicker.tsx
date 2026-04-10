import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const AGE_VALUES = Array.from({ length: 88 }, (_, i) => i + 13);

interface ScrollColumnProps {
  selected: number;
  onChange: (age: number) => void;
  onSelect: (age: number) => void;
}

function ScrollColumn({ selected, onChange, onSelect }: ScrollColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScroll = useRef(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  const selectedIndex = AGE_VALUES.indexOf(selected);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    isUserScroll.current = false;
    el.scrollTo({ top: selectedIndex * ITEM_HEIGHT, behavior: 'smooth' });
    const t = setTimeout(() => { isUserScroll.current = true; }, 300);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  useEffect(() => () => { if (scrollTimer.current) clearTimeout(scrollTimer.current); }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !isUserScroll.current) return;
    const index = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, AGE_VALUES.length - 1));
    if (AGE_VALUES[clamped] !== selected) onChange(AGE_VALUES[clamped]);
  }, [selected, onChange]);

  const onScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      handleScroll();
      const el = containerRef.current;
      if (el) {
        const index = Math.round(el.scrollTop / ITEM_HEIGHT);
        isUserScroll.current = false;
        el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
        setTimeout(() => { isUserScroll.current = true; }, 300);
      }
    }, 80);
  }, [handleScroll]);

  const pickerHeight = ITEM_HEIGHT * VISIBLE_ITEMS;
  const highlightTop = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

  return (
    <div className="relative" style={{ height: pickerHeight }}>
      <div
        className="pointer-events-none absolute inset-x-2 rounded-[12px] bg-border/40"
        style={{ height: ITEM_HEIGHT, top: highlightTop }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: pickerHeight * 0.35,
          background: 'linear-gradient(to bottom, rgb(var(--color-surface-secondary)), transparent)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{
          height: pickerHeight * 0.35,
          background: 'linear-gradient(to top, rgb(var(--color-surface-secondary)), transparent)',
        }}
      />
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="absolute inset-0 overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: 'none' }}
      >
        <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
        {AGE_VALUES.map((age) => (
          <button
            key={age}
            type="button"
            onClick={() => onSelect(age)}
            className={`flex w-full select-none items-center justify-center transition-all duration-150 ${
              age === selected
                ? 'text-[18px] font-bold text-content'
                : 'text-[15px] font-normal text-content-tertiary'
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {age}
          </button>
        ))}
        <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
      </div>
    </div>
  );
}

interface AgeScrollPickerProps {
  value: number;
  onChange: (age: number) => void;
}

export function AgeScrollPicker({ value, onChange }: AgeScrollPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (age: number) => {
    onChange(age);
    setOpen(false);
  };

  return (
    <div className="overflow-hidden rounded-[16px] bg-surface-secondary shadow-[0px_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center px-[16px] py-[14px]"
      >
        <span className="flex-1 text-center text-[15px] font-medium text-content">
          {open ? 'Select your age' : (value ?? 'Select your age')}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-content-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? `${ITEM_HEIGHT * VISIBLE_ITEMS + 8}px` : '0px' }}
      >
        <div className="pb-2">
          <ScrollColumn selected={value} onChange={onChange} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}

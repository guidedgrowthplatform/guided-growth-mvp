import { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollColumnProps {
  label: string;
  values: number[];
  selectedValue: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

const ITEM_HEIGHT = 48;
const VISIBLE_COUNT = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const PADDING_COUNT = Math.floor(VISIBLE_COUNT / 2);
const LABEL_HEIGHT = 36;

function ScrollColumn({
  label,
  values,
  selectedValue,
  onChange,
  formatValue = (v) => String(v).padStart(2, '0'),
}: ScrollColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(0, values.indexOf(selectedValue)),
  );

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex]);

  const snapToNearest = useCallback(
    (container: HTMLDivElement) => {
      const index = Math.round(container.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, index));
      container.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
      setSelectedIndex(clamped);
      onChange(values[clamped]);
    },
    [values, onChange],
  );

  const scheduleSnap = useCallback(() => {
    if (isDragging.current) return;
    const container = containerRef.current;
    if (!container) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => snapToNearest(container), 100);
  }, [snapToNearest]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startScrollTop.current = containerRef.current?.scrollTop ?? 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    containerRef.current.scrollTop =
      startScrollTop.current + (startY.current - e.touches[0].clientY);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) snapToNearest(containerRef.current);
  }, [snapToNearest]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startScrollTop.current = containerRef.current?.scrollTop ?? 0;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      containerRef.current.scrollTop = startScrollTop.current + (startY.current - e.clientY);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (containerRef.current) snapToNearest(containerRef.current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [snapToNearest]);

  return (
    <div className="flex w-[64px] flex-col items-center">
      <span className="pb-1 text-[12px] font-semibold text-content">{label}</span>
      <div
        ref={containerRef}
        className="cursor-grab overflow-y-scroll active:cursor-grabbing"
        style={{ height: PICKER_HEIGHT, scrollbarWidth: 'none' }}
        onScroll={scheduleSnap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {Array.from({ length: PADDING_COUNT }).map((_, i) => (
          <div key={`pt-${i}`} style={{ height: ITEM_HEIGHT }} />
        ))}
        {values.map((value, index) => (
          <div
            key={value}
            className={`flex select-none items-center justify-center text-[18px] ${
              index === selectedIndex ? 'font-bold text-[#0f172a]' : 'font-normal text-[#d1d5db]'
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {formatValue(value)}
          </div>
        ))}
        {Array.from({ length: PADDING_COUNT }).map((_, i) => (
          <div key={`pb-${i}`} style={{ height: ITEM_HEIGHT }} />
        ))}
      </div>
    </div>
  );
}

interface TimePickerProps {
  hours: number;
  minutes: number;
  seconds: number;
  onChangeHours: (v: number) => void;
  onChangeMinutes: (v: number) => void;
  onChangeSeconds: (v: number) => void;
  hourValues: number[];
  minuteValues: number[];
  secondValues: number[];
}

export function TimePicker({
  hours,
  minutes,
  seconds,
  onChangeHours,
  onChangeMinutes,
  onChangeSeconds,
  hourValues,
  minuteValues,
  secondValues,
}: TimePickerProps) {
  return (
    <div className="relative rounded-[24px] bg-white px-6 pb-8 pt-3">
      <div
        className="pointer-events-none absolute inset-x-6 rounded-[12px] bg-[#f9fafb]"
        style={{
          height: ITEM_HEIGHT,
          top: LABEL_HEIGHT + PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 rounded-t-[24px] bg-gradient-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 rounded-b-[24px] bg-gradient-to-t from-white to-transparent" />

      <div className="relative z-10 flex items-start justify-center">
        <ScrollColumn
          label="Hour"
          values={hourValues}
          selectedValue={hours}
          onChange={onChangeHours}
        />

        <div
          className="flex w-8 items-center justify-center"
          style={{ height: PICKER_HEIGHT, paddingTop: 24 }}
        >
          <span className="text-[24px] font-bold text-[#9ca3af]">:</span>
        </div>

        <ScrollColumn
          label="Minute"
          values={minuteValues}
          selectedValue={minutes}
          onChange={onChangeMinutes}
        />

        <div className="w-8" />

        <ScrollColumn
          label="Second"
          values={secondValues}
          selectedValue={seconds}
          onChange={onChangeSeconds}
        />
      </div>
    </div>
  );
}

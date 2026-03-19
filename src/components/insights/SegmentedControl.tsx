import { useEffect, useRef, useState } from 'react';

interface SegmentedControlProps {
  items: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  size: 'lg' | 'sm';
}

export function SegmentedControl({ items, value, onChange, size }: SegmentedControlProps) {
  const isLg = size === 'lg';
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const activeIndex = items.findIndex((item) => item.value === value);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const active = buttons[activeIndex];
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`relative flex rounded-lg p-[4px] ${isLg ? 'bg-border/50' : 'bg-border-light'}`}
    >
      <div
        className={`absolute bottom-[4px] top-[4px] transition-all duration-300 ease-out ${
          isLg ? 'rounded-md bg-primary shadow-sm' : 'rounded-lg bg-surface shadow-sm'
        }`}
        style={{ left: indicator.left, width: indicator.width }}
      />

      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`relative z-[1] flex-1 text-center text-[14px] transition-colors duration-300 ${
              isLg ? 'rounded-md py-[10px]' : 'rounded-lg py-[8px]'
            } ${
              active
                ? isLg
                  ? 'font-bold text-white'
                  : 'font-semibold text-primary'
                : isLg
                  ? 'font-semibold text-content-muted'
                  : 'font-medium text-content-muted'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

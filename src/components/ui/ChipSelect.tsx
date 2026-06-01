import { useCallback, useEffect, useRef } from 'react';

interface ChipSelectProps {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  columns?: number;
  /**
   * Accessible name for the radiogroup. Required for assistive tech to
   * announce what is being chosen (e.g. "How do you identify?"). When
   * omitted, the group is still a valid radiogroup but unnamed.
   */
  ariaLabel?: string;
}

export function ChipSelect({ options, value, onChange, columns = 3, ariaLabel }: ChipSelectProps) {
  // Group options into rows
  const rows: string[][] = [];
  for (let i = 0; i < options.length; i += columns) {
    rows.push(options.slice(i, i + columns));
  }

  // One ref per option index, used for roving-focus arrow-key navigation
  // (required by the `role="radio"` ARIA pattern: arrow keys move focus
  // AND change selection within the group).
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    optionRefs.current = optionRefs.current.slice(0, options.length);
  }, [options.length]);

  const focusAndSelect = useCallback(
    (nextIndex: number) => {
      const wrapped = (nextIndex + options.length) % options.length;
      const target = options[wrapped];
      if (target === undefined) return;
      onChange(target);
      // Defer focus to after React commits the updated tabindex/selected state.
      requestAnimationFrame(() => {
        optionRefs.current[wrapped]?.focus();
      });
    },
    [onChange, options],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
          // Horizontal movement wraps along flat option order.
          event.preventDefault();
          focusAndSelect(index + 1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          focusAndSelect(index - 1);
          break;
        case 'ArrowDown': {
          // Vertical movement is grid-aware (±columns), clamped — no wrap.
          event.preventDefault();
          const next = index + columns;
          if (next < options.length) focusAndSelect(next);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const next = index - columns;
          if (next >= 0) focusAndSelect(next);
          break;
        }
        case 'Home':
          event.preventDefault();
          focusAndSelect(0);
          break;
        case 'End':
          event.preventDefault();
          focusAndSelect(options.length - 1);
          break;
        default:
          break;
      }
    },
    [columns, focusAndSelect, options.length],
  );

  // Roving tabindex: only the currently-selected option (or the first option
  // when nothing is selected) is reachable via Tab. Arrow keys move within.
  const selectedIndex = value === null ? -1 : options.indexOf(value);
  const tabStopIndex = selectedIndex === -1 ? 0 : selectedIndex;

  let flatIndex = -1;

  return (
    <div role="radiogroup" aria-label={ariaLabel || undefined} className="flex flex-col gap-[12px]">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[12px]">
          {row.map((option) => {
            flatIndex += 1;
            const index = flatIndex;
            const isSelected = value === option;
            return (
              <button
                key={option}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={index === tabStopIndex ? 0 : -1}
                onClick={() => onChange(option)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`flex-1 whitespace-nowrap rounded-full px-[12px] py-[10px] text-center text-[14px] font-bold leading-[20px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isSelected ? 'bg-primary text-white' : 'bg-surface-secondary text-content-subtle'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

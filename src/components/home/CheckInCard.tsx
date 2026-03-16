import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { CheckInDimension } from '@shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

type CheckInValues = Record<CheckInDimension, number | null>;

interface CheckInCardProps {
  selectedDate: string;
}

export function CheckInCard({ selectedDate: _selectedDate }: CheckInCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<CheckInValues>({
    sleep: null,
    mood: null,
    energy: null,
    stress: null,
  });

  const handleSelect = (key: CheckInDimension, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheckIn = () => {
    // TODO: connect to backend
    console.log('Check-in values:', values);
    setExpanded(false);
  };

  return (
    <div className="rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-xl font-bold text-content">How are you feeling?</span>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-content-tertiary" />
        ) : (
          <ChevronRight className="h-5 w-5 text-content-tertiary" />
        )}
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          {checkInDimensions.map((dimension) => (
            <div key={dimension.key}>
              <p className="mb-2 text-sm font-medium text-content-secondary">{dimension.label}</p>
              <div className="flex justify-between">
                {dimension.options.map((option) => (
                  <EmojiOptionButton
                    key={option.value}
                    emoji={option.emoji}
                    label={option.label}
                    color={option.color}
                    isSelected={values[dimension.key] === option.value}
                    onClick={() => handleSelect(dimension.key, option.value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={expanded ? handleCheckIn : () => setExpanded(true)}
        className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white shadow-[0px_4px_6px_-1px_rgba(65,105,225,0.2)] transition-colors hover:bg-primary-dark"
      >
        Check In
      </button>
    </div>
  );
}

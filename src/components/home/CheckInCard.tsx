import { useState } from 'react';
import type { CheckInDimension } from '@shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

type CheckInValues = Record<CheckInDimension, number | null>;

interface CheckInCardProps {
  selectedDate: string;
  onClose?: () => void;
}

export function CheckInCard({ selectedDate: _selectedDate, onClose }: CheckInCardProps) {
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
    onClose?.();
  };

  return (
    <div className="rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
      <div className="space-y-5">
        {checkInDimensions.map((dimension) => (
          <div key={dimension.key}>
            <p className="mb-2 text-sm font-medium text-content-secondary">{dimension.label}</p>
            <div className="flex justify-between">
              {dimension.options.map((option) => (
                <EmojiOptionButton
                  key={option.value}
                  icon={option.icon}
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

      <button
        onClick={handleCheckIn}
        className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white shadow-[0px_4px_6px_-1px_rgba(65,105,225,0.2)] transition-colors hover:bg-primary-dark"
      >
        Check In
      </button>
    </div>
  );
}

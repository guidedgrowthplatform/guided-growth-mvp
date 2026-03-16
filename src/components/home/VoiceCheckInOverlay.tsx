import { Mic, Loader2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { CheckInDimension } from '@shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

interface VoiceCheckInOverlayProps {
  onClose: () => void;
}

export function VoiceCheckInOverlay({ onClose }: VoiceCheckInOverlayProps) {
  const [values, setValues] = useState<Record<CheckInDimension, number | null>>({
    sleep: null,
    mood: null,
    energy: null,
    stress: null,
  });

  const handleSelect = (dimension: CheckInDimension, value: number) => {
    setValues((prev) => ({
      ...prev,
      [dimension]: prev[dimension] === value ? null : value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(4,4,4,0.3)] via-[rgba(26,26,26,0.18)] to-[rgba(81,81,81,0.09)] backdrop-blur-[15px]" />

      {/* Scrollable content */}
      <div
        className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-5 pb-40 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Check-in card */}
        <div className="w-full max-w-sm rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-content">How are you feeling?</h2>
            <ChevronDown className="h-5 w-5 text-content-secondary" />
          </div>

          <div className="flex flex-col gap-5">
            {checkInDimensions.map((dim) => (
              <div key={dim.key}>
                <p className="mb-2 text-sm font-medium text-content-secondary">{dim.label}</p>
                <div className="flex justify-between">
                  {dim.options.map((opt) => (
                    <EmojiOptionButton
                      key={opt.value}
                      icon={opt.icon}
                      label={opt.label}
                      color={opt.color}
                      isSelected={values[dim.key] === opt.value}
                      onClick={() => handleSelect(dim.key, opt.value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="mt-5 w-full rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-[0px_4px_6px_-1px_rgba(65,105,225,0.2),0px_2px_4px_-2px_rgba(65,105,225,0.2)]">
            Check In
          </button>
        </div>

        {/* Talking pill */}
        <div className="mt-8 flex items-center gap-2 rounded-[10px] bg-primary px-3 py-1.5">
          <span className="text-sm font-medium text-white">Talking</span>
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>

        {/* Chat message */}
        <p className="mt-4 max-w-[227px] text-center text-sm font-medium text-white">
          Hi there! how are you feeling right now regarding your energy, mood, or stress?
        </p>
      </div>

      {/* Mic button */}
      <div
        className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center">
          {/* Outer pulse ring 1 */}
          <div className="absolute h-[93px] w-[93px] animate-pulse rounded-full border-[3px] border-[#89c9ff] opacity-40 shadow-[0px_4px_16px_20px_rgba(65,105,225,0.2)]" />
          {/* Outer pulse ring 2 */}
          <div className="absolute h-[87px] w-[87px] animate-pulse rounded-full border-[3px] border-[#89c9ff] opacity-40 shadow-[0px_4px_16px_20px_rgba(65,105,225,0.2)]" />
          {/* Mic button */}
          <button className="relative flex h-[75px] w-[75px] items-center justify-center rounded-full bg-gradient-to-br from-[#135bec] to-[#2563eb] shadow-[0px_0px_15px_0px_rgba(19,91,236,0.3)]">
            <Mic className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

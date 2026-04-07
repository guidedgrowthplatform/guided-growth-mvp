import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useCheckIn } from '@/hooks/useCheckIn';
import { speak, stopTTS } from '@/lib/services/tts-service';
import type { CheckInDimension } from '@shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

type CheckInValues = Record<CheckInDimension, number | null>;

const emptyValues: CheckInValues = { sleep: null, mood: null, energy: null, stress: null };

interface CheckInCardProps {
  selectedDate: string;
  onClose?: () => void;
}

export function CheckInCard({ selectedDate, onClose }: CheckInCardProps) {
  const { checkIn, loading, saving, save } = useCheckIn(selectedDate);
  const { addToast } = useToast();
  const [values, setValues] = useState<CheckInValues>(emptyValues);

  // TTS greeting — ref guard prevents React StrictMode double-fire
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    const hour = new Date().getHours();
    if (hour < 15) {
      speak("Quick check-in \u2014 how'd you sleep? How's your energy?");
    } else {
      speak("Hey \u2014 how was today?");
    }
    return () => { stopTTS(); };
  }, []);

  useEffect(() => {
    if (checkIn) {
      setValues({
        sleep: checkIn.sleep,
        mood: checkIn.mood,
        energy: checkIn.energy,
        stress: checkIn.stress,
      });
    } else {
      setValues(emptyValues);
    }
  }, [checkIn]);

  const handleSelect = (key: CheckInDimension, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheckIn = async () => {
    try {
      await save(values);
      // TTS coaching response per Voice Journey Spreadsheet v3 (line 386)
      const hour = new Date().getHours();
      if (hour < 15) {
        // Morning coaching
        speak("Got it \u2014 logged. You've got this today.");
      } else {
        // Evening coaching
        speak("Logged. Thanks for checking in \u2014 rest well tonight.");
      }
      onClose?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save check-in';
      addToast('error', msg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
        <p className="text-sm text-content-secondary">Loading check-in...</p>
      </div>
    );
  }

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
        disabled={saving}
        className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white shadow-[0px_4px_6px_-1px_rgba(65,105,225,0.2)] transition-colors hover:bg-primary-dark active:bg-primary-dark disabled:opacity-50"
      >
        {saving ? 'Saving...' : checkIn ? 'Update Check-In' : 'Check In'}
      </button>
    </div>
  );
}

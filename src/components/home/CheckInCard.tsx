import { Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { useCheckIn } from '@/hooks/useCheckIn';
import { speak, stopTTS } from '@/lib/services/tts-service';
import type { CheckInData, CheckInDimension } from '@gg/shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

type CheckInValues = Record<CheckInDimension, number | null>;

const emptyValues: CheckInValues = { sleep: null, mood: null, energy: null, stress: null };

// Labels for check-in dimensions used in evening narrative
const energyLabels: Record<number, string> = {
  1: 'drained',
  2: 'low',
  3: 'medium',
  4: 'active',
  5: 'charged',
};
const sleepLabels: Record<number, string> = {
  1: 'poor',
  2: 'fair',
  3: 'good',
  4: 'great',
  5: 'deep',
};
const moodLabels: Record<number, string> = {
  1: 'awful',
  2: 'bad',
  3: 'meh',
  4: 'good',
  5: 'awesome',
};

/**
 * Build evening TTS that references morning check-in data.
 * Voice Journey v3 line 386-392: "You said this morning your energy was low —
 * and you still showed up. That's exactly how this works."
 */
function buildEveningReference(morningCheckIn: CheckInData | null): string {
  if (!morningCheckIn) {
    return 'Logged. Thanks for checking in \u2014 rest well tonight.';
  }

  const { energy, sleep, mood } = morningCheckIn;

  // Find the lowest dimension from morning to acknowledge
  if (energy !== null && energy <= 2) {
    const label = energyLabels[energy];
    return `You said this morning your energy was ${label} \u2014 and you still showed up. That's exactly how this works. Rest well tonight.`;
  }
  if (sleep !== null && sleep <= 2) {
    const label = sleepLabels[sleep];
    return `You started today with ${label} sleep \u2014 and you still made it through. That takes something. Rest well tonight.`;
  }
  if (mood !== null && mood <= 2) {
    const label = moodLabels[mood];
    return `Your mood was ${label} this morning \u2014 and you showed up anyway. The hard days are the ones that count most. Rest well.`;
  }

  // All morning metrics were good
  if (energy !== null && energy >= 4) {
    return `You came in feeling ${energyLabels[energy]} this morning \u2014 and you followed through. That's momentum. Rest well tonight.`;
  }

  return 'Logged. Another day in the books. Rest well tonight.';
}

interface CheckInCardProps {
  selectedDate: string;
  onClose?: () => void;
}

export function CheckInCard({ selectedDate, onClose }: CheckInCardProps) {
  // hour < 15 mirrors the morning/evening logic used for the TTS greeting and
  // analytics events below — keep them in sync.
  const isMorning = new Date().getHours() < 15;
  const { checkIn, loading, saving, save } = useCheckIn(selectedDate, {
    type: isMorning ? 'morning' : 'evening',
    screenId: isMorning ? 'MCHECK-01' : 'ECHECK-06',
  });
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [values, setValues] = useState<CheckInValues>(emptyValues);
  // GitLab #171: post-save confirmation state so the user gets a visible
  // acknowledgement + a way to jump straight to their check-in history.
  const [showSuccess, setShowSuccess] = useState(false);

  const completedRef = useRef(false);
  const mountTimeRef = useRef<number>(0);
  const valuesRef = useRef<CheckInValues>(emptyValues);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  // TTS greeting — ref guard prevents React StrictMode double-fire
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    const hour = new Date().getHours();
    if (hour < 15) {
      speak("Quick check-in \u2014 how'd you sleep? How's your energy?");
    } else {
      speak('Hey \u2014 how was today?');
    }
    return () => {
      stopTTS();
    };
  }, []);

  // Abandon tracking — if unmount without submit, fire abandon_checkin
  useEffect(() => {
    mountTimeRef.current = Date.now();
    const start = mountTimeRef.current;
    return () => {
      if (!completedRef.current) {
        const v = valuesRef.current;
        const filled = [v.sleep, v.mood, v.energy, v.stress].filter((x) => x !== null).length;
        if (filled > 0) {
          const hour = new Date().getHours();
          track('abandon_checkin', {
            checkin_type: hour < 15 ? 'morning' : 'evening',
            fields_completed: filled,
            time_spent_seconds: Math.round((Date.now() - start) / 1000),
          });
        }
      }
    };
  }, []);

  // Card is CSS-collapsed (never remounted), so success + completed flags
  // must be reset when the user moves to another date — otherwise a stale
  // success view + dead abandon tracking carry across day switches.
  useEffect(() => {
    setShowSuccess(false);
    completedRef.current = false;
  }, [selectedDate]);

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
      completedRef.current = true;
      const hour = new Date().getHours();
      track('complete_checkin', {
        checkin_type: hour < 15 ? 'morning' : 'evening',
        sleep_quality: values.sleep,
        mood: values.mood,
        energy_level: values.energy,
        stress_level: values.stress,
        duration_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
        is_update: Boolean(checkIn),
      });
      // TTS coaching response per Voice Journey Spreadsheet v3 (line 386-392)
      if (hour < 15) {
        // Morning coaching
        speak("Got it \u2014 logged. You've got this today.");
      } else {
        // Evening coaching — reference morning data for narrative arc
        // (Voice Journey v3: "You said this morning your energy was low — and you still showed up")
        const morningRef = buildEveningReference(checkIn);
        speak(morningRef);
      }
      // GitLab #171: show the in-place success confirmation instead of
      // closing silently. The user dismisses via the CTA (navigates to
      // history) or by collapsing the card from HomePage's QuickActionCards.
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save check-in';
      addToast('error', msg);
    }
  };

  const handleViewHistory = () => {
    onClose?.();
    navigate('/report', { state: { tab: 'history' } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
        <p className="text-sm text-content-secondary">Loading check-in...</p>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-border-light bg-surface p-5 text-center shadow-sm"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-content">Check-in saved</h3>
        <p className="mt-1 text-sm text-content-secondary">
          {isMorning
            ? "You're set for the day — see how today fits into your week."
            : 'Another day logged — see how it fits into your week.'}
        </p>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={handleViewHistory}
          className="mt-4 rounded-full"
        >
          See your check-in history
        </Button>
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

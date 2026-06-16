import { Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { IconMic } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { useToast } from '@/contexts/ToastContext';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useCheckinDoneToday } from '@/hooks/useCheckinDoneToday';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { unlockTTS } from '@/lib/services/tts-service';
import { bucketTimeOfDay } from '@gg/shared/time/bucketTimeOfDay';
import type { CheckInDimension } from '@gg/shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';

type CheckInValues = Record<CheckInDimension, number | null>;

const emptyValues: CheckInValues = { sleep: null, mood: null, energy: null, stress: null };

interface CheckInCardProps {
  selectedDate: string;
  onClose?: () => void;
}

export function CheckInCard({ selectedDate, onClose }: CheckInCardProps) {
  // captured at mount; card is CSS-collapsed, not remounted.
  // 'morning' bucket only (<12 local); afternoon/evening/night → evening check-in.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isMorning = bucketTimeOfDay(new Date(), tz) === 'morning';
  const { checkIn, loading, saving, save } = useCheckIn(selectedDate, {
    type: isMorning ? 'morning' : 'evening',
    screenId: isMorning ? 'MCHECK-01' : 'ECHECK-01',
  });
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { openCoachChat } = useCoachChatLauncher();
  const { micAllowed, requestMicPermission } = useDualButtonControls();
  const { updatePreferences } = useUserPreferences();
  const doneToday = useCheckinDoneToday(isMorning ? 'morning' : 'evening', checkIn !== null);
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

  // Abandon tracking — if unmount without submit, fire abandon_checkin
  useEffect(() => {
    mountTimeRef.current = Date.now();
    const start = mountTimeRef.current;
    return () => {
      if (!completedRef.current) {
        const v = valuesRef.current;
        const filled = [v.sleep, v.mood, v.energy, v.stress].filter((x) => x !== null).length;
        if (filled > 0) {
          track('abandon_checkin', {
            checkin_type: isMorning ? 'morning' : 'evening',
            fields_completed: filled,
            time_spent_seconds: Math.round((Date.now() - start) / 1000),
          });
        }
      }
    };
  }, [isMorning]);

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
      track('complete_checkin', {
        checkin_type: isMorning ? 'morning' : 'evening',
        sleep_quality: values.sleep,
        mood: values.mood,
        energy_level: values.energy,
        stress_level: values.stress,
        duration_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
        is_update: Boolean(checkIn),
      });
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

  const handleTalk = async () => {
    unlockTTS();
    // "Talk instead" implies State 3 (voice off, mic on). Request permission if
    // needed, set the orb state so the chat opens with the mic already armed.
    const granted = micAllowed || (await requestMicPermission()) === 'granted';
    await updatePreferences({
      voiceMode: 'screen',
      micEnabled: granted,
    });
    // Once-per-day: a done bucket just opens the timeline, no proactive re-ask.
    openCoachChat(isMorning ? 'MCHECK-01' : 'ECHECK-01', { initiateCheckin: !doneToday });
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

      <button
        onClick={handleTalk}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border-light py-2.5 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-secondary"
      >
        <IconMic className="h-4 w-4" />
        {isMorning ? 'Talk through your morning' : 'Talk through your day'}
      </button>
    </div>
  );
}

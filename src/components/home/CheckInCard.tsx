import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { speak, stopTTS } from '@/lib/services/tts-service';
import type { CheckInData, CheckInDimension } from '@shared/types';
import { checkInDimensions } from './checkInConfig';
import { EmojiOptionButton } from './EmojiOptionButton';
import { MorningGoalPrompt } from './MorningGoalPrompt';

type CheckInValues = Record<CheckInDimension, number | null>;
type CheckInPhase = 'scales' | 'morning_goal';

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
  const { checkIn, loading, saving, save } = useCheckIn(selectedDate);
  const { addToast } = useToast();
  const voicePlayer = useVoicePlayer();
  const [values, setValues] = useState<CheckInValues>(emptyValues);
  const [phase, setPhase] = useState<CheckInPhase>('scales');

  // TTS greeting — ref guard prevents React StrictMode double-fire
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    // Play pre-recorded check-in prompt MP3
    voicePlayer.play('checkin_prompt').catch(() => {
      // Fallback to dynamic TTS if MP3 fails
      const hour = new Date().getHours();
      if (hour < 15) {
        speak("Quick check-in \u2014 how'd you sleep? How's your energy?");
      } else {
        speak('Hey \u2014 how was today?');
      }
    });
    return () => {
      stopTTS();
      voicePlayer.stop();
    };
  }, [voicePlayer]);

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
      const hour = new Date().getHours();
      if (hour < 15) {
        // Morning: play completion MP3, then show goal prompt (MCHECK-02)
        voicePlayer.play('checkin_complete').catch(() => {
          speak('Got it \u2014 logged.');
        });
        // Transition to morning goal prompt after a short delay
        setTimeout(() => setPhase('morning_goal'), 2000);
      } else {
        // Evening coaching — reference morning data for narrative arc (dynamic TTS)
        const morningRef = buildEveningReference(checkIn);
        speak(morningRef);
        onClose?.();
      }
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

  // MCHECK-02: Morning goal prompt phase
  if (phase === 'morning_goal') {
    return <MorningGoalPrompt onClose={() => onClose?.()} />;
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

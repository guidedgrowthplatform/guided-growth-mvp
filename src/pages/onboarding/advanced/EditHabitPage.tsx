import { Icon } from '@iconify/react';
import { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SECTION_LABEL_CLASS, toggleSetItem } from '@/components/onboarding/constants';
import { DeleteHabitModal } from '@/components/onboarding/DeleteHabitModal';
import { VoiceEditCard } from '@/components/onboarding/VoiceEditCard';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak, speakWhenReady, stopTTS } from '@/lib/services/tts-service';

interface EditHabitState {
  habitIndex: number;
  habitName: string;
  days: number[];
  time: string;
}

const FIELD_LABEL_CLASS =
  'px-[4px] text-[12px] font-semibold uppercase leading-[16px] tracking-[0.6px] text-content-muted';

export function EditHabitPage() {
  const location = useLocation();
  const state = location.state as EditHabitState | null;

  if (!state) {
    return <Navigate to="/onboarding/advanced-results" replace />;
  }

  return <EditHabitForm state={state} />;
}

function EditHabitForm({ state }: { state: EditHabitState }) {
  const navigate = useNavigate();
  const { toggle: toggleVoice, transcript, resetTranscript } = useVoiceInput();

  const [name, setName] = useState(state.habitName);
  const [time, setTime] = useState(state.time || '21:45');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [days, setDays] = useState<Set<number>>(new Set(state.days));
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const habitIndex = state.habitIndex;

  // When voice transcript arrives, use it as the habit name.
  // Skip transcripts that are too short to be a meaningful habit name —
  // filters out filler like "uh", "um", "ok" so an accidental mic tap
  // doesn't wipe an existing habit name with junk.
  useEffect(() => {
    if (!transcript) return;
    const cleaned = transcript.trim();
    if (cleaned.length < 3) {
      resetTranscript();
      return;
    }
    setName(cleaned);
    resetTranscript();
  }, [transcript, resetTranscript]);

  // TTS per Voice Journey Spreadsheet v3 (line 471).
  // speakWhenReady() defers to first user gesture if TTS hasn't been
  // unlocked yet — protects against iOS WKWebView autoplay block when
  // EditHabit is the first page where TTS would fire.
  const hasSpoken = useRef(false);
  useEffect(() => {
    if (hasSpoken.current) return;
    hasSpoken.current = true;
    const cancel = speakWhenReady('What do you want to change about this habit?');
    return () => {
      cancel();
      stopTTS();
    };
  }, []);

  function handleSave() {
    if (!name.trim()) return;
    speak('Updated. All good?');
    navigate('/onboarding/advanced-results', {
      state: {
        updatedHabit: { index: habitIndex, name: name.trim(), time, days: Array.from(days) },
      },
    });
  }

  function handleDelete() {
    navigate('/onboarding/advanced-results', { state: { deletedIndex: habitIndex } });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-secondary/80 px-6 py-[16px] backdrop-blur-[6px]">
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-results')}
          className="flex size-[40px] items-center"
        >
          <Icon icon="ic:round-arrow-back" width={24} height={24} className="text-content" />
        </button>
        <span className="text-[18px] font-bold leading-[28px] text-content">Edit Habit</span>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="flex size-[40px] items-center justify-end"
        >
          <Icon
            icon="material-symbols:delete-outline"
            width={24}
            height={24}
            className="text-danger"
          />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-[32px] overflow-y-auto px-6 pb-[128px] pt-[16px]">
        {/* Form Fields */}
        <div className="flex flex-col gap-[24px]">
          {/* Habit Name */}
          <div className="flex flex-col gap-[8px]">
            <label className={FIELD_LABEL_CLASS}>Habit Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full rounded-[12px] border border-border bg-surface-secondary px-[17px] py-[15px] text-[16px] font-medium leading-[24px] text-content outline-none"
            />
          </div>

          {/* When? */}
          <div className="flex flex-col gap-[16px]">
            <span className={SECTION_LABEL_CLASS}>When?</span>
            <button
              type="button"
              onClick={() => setTimePickerOpen(true)}
              className="flex w-full items-center justify-between rounded-[24px] border border-primary bg-surface px-[21px] py-[15px]"
            >
              <span className="text-[15px] font-bold text-content">{formatTime12(time)}</span>
              <Icon icon="ic:round-access-time" width={20} height={20} className="text-primary" />
            </button>
          </div>

          {/* How Often? */}
          <div className="flex flex-col gap-[12px]">
            <label className={FIELD_LABEL_CLASS}>How Often?</label>
            <div className="rounded-[12px] border border-border bg-surface px-[13px] py-[13px]">
              <DayPicker
                selectedDays={days}
                onToggleDay={(day) => setDays((prev) => toggleSetItem(prev, day))}
              />
            </div>
          </div>
        </div>

        <VoiceEditCard onMicPress={toggleVoice} />
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-t from-surface-secondary via-surface-secondary/95 to-transparent px-6 py-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full rounded-full bg-primary py-[16px] text-center text-[16px] font-bold text-white shadow-[0px_10px_15px_-3px_rgb(var(--color-primary)/0.25),0px_4px_6px_-4px_rgb(var(--color-primary)/0.15)] disabled:opacity-50"
        >
          Save Changes
        </button>
      </div>

      {showDeleteModal && (
        <DeleteHabitModal onDelete={handleDelete} onKeep={() => setShowDeleteModal(false)} />
      )}

      {timePickerOpen && (
        <TimePickerSheet
          value={time}
          onChange={setTime}
          onClose={() => setTimePickerOpen(false)}
        />
      )}
    </div>
  );
}

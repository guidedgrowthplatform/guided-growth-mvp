import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
import { SECTION_LABEL_CLASS, toggleSetItem } from '@/components/onboarding/constants';
import { DeleteHabitModal } from '@/components/onboarding/DeleteHabitModal';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';
import { type OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';
import { useStepTiming } from '../shared/useStepTiming';

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
  const trackStepComplete = useStepTiming(6, 'edit_habit', 'advanced');

  const [name, setName] = useState(state.habitName);
  const [time, setTime] = useState(state.time || '21:45');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [days, setDays] = useState<Set<number>>(new Set(state.days));
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const habitIndex = state.habitIndex;

  // Voice edits for the habit in focus, applied via the orb (Vapi).
  function handleVoiceAction(result: OnboardingVoiceResult) {
    if (result.action !== 'update_habit') return;
    const patch = (result.params as { patch?: { days?: number[]; time?: string } }).patch;
    if (!patch) return;
    if (Array.isArray(patch.days)) setDays(new Set(patch.days));
    if (typeof patch.time === 'string') setTime(patch.time);
  }

  function handleSave() {
    if (!name.trim()) return;
    track('edit_habit', {
      habit_name: name.trim(),
      frequency_days: days.size,
      source: 'onboarding',
    });
    trackStepComplete();
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
    <OnboardingLayout
      currentStep={4}
      ctaLabel="Continue"
      onNext={handleSave}
      ctaDisabled={!name.trim()}
      onVoiceAction={handleVoiceAction}
      showVoiceButton
      hideOpenChat
      bgVariant="secondary"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-[8px]">
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

      {showDeleteModal && (
        <DeleteHabitModal onDelete={handleDelete} onKeep={() => setShowDeleteModal(false)} />
      )}

      {timePickerOpen && (
        <TimePickerSheet value={time} onChange={setTime} onClose={() => setTimePickerOpen(false)} />
      )}
    </OnboardingLayout>
  );
}

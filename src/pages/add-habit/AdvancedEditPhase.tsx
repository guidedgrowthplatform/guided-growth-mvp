import { Icon } from '@iconify/react';
import { DeleteHabitModal } from '@/components/onboarding/DeleteHabitModal';
import { SECTION_LABEL_CLASS, toggleSetItem } from '@/components/onboarding/constants';
import { DayPicker } from '@/components/ui/DayPicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { AddHabitHeader } from './AddHabitHeader';

interface AdvancedEditPhaseProps {
  editName: string;
  setEditName: (name: string) => void;
  editDays: Set<number>;
  setEditDays: (fn: (prev: Set<number>) => Set<number>) => void;
  editTime: string;
  setEditTime: (time: string) => void;
  onSave: () => void;
  onDelete: () => void;
  showDeleteModal: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  isListening: boolean;
  toggleVoice: () => void;
  onBack: () => void;
}

export function AdvancedEditPhase({
  editName,
  setEditName,
  editDays,
  setEditDays,
  editTime,
  setEditTime,
  onSave,
  onDelete,
  showDeleteModal,
  onConfirmDelete,
  onCancelDelete,
  isListening,
  toggleVoice,
  onBack,
}: AdvancedEditPhaseProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-primary-bg px-5 pb-8 pt-[max(16px,env(safe-area-inset-top))]">
      <AddHabitHeader onBack={onBack} />

      <div className="flex flex-1 flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className={SECTION_LABEL_CLASS}>Habit name</span>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={100}
            className="w-full rounded-2xl border border-border bg-surface px-5 py-4 text-[16px] font-medium text-content outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className={SECTION_LABEL_CLASS}>When?</span>
          <div className="flex w-full items-center justify-between rounded-3xl border border-primary bg-primary/5 px-5 py-4">
            <TimePicker value={editTime} onChange={setEditTime} />
            <Icon icon="ic:round-access-time" className="size-5 text-primary" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className={SECTION_LABEL_CLASS}>How often?</span>
          <DayPicker
            selectedDays={editDays}
            onToggleDay={(day) => setEditDays((prev) => toggleSetItem(prev, day))}
          />
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-2 self-start text-[16px] font-semibold text-red-500"
        >
          <Icon icon="ic:round-delete" className="size-5" />
          Delete this habit
        </button>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          type="button"
          onClick={onSave}
          className="flex-1 rounded-full bg-primary py-4 text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25)]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={toggleVoice}
          className={`flex size-14 items-center justify-center rounded-full bg-primary shadow-[0px_25px_50px_-12px_rgba(19,91,236,0.4)] ${
            isListening ? 'animate-pulse ring-4 ring-primary/30' : ''
          }`}
        >
          <Icon icon="ic:round-mic" className="size-[22px] text-white" />
        </button>
      </div>
      {isListening && (
        <p className="mt-2 animate-pulse text-center text-sm font-medium text-primary">
          Listening...
        </p>
      )}

      {showDeleteModal && <DeleteHabitModal onDelete={onConfirmDelete} onKeep={onCancelDelete} />}
    </div>
  );
}

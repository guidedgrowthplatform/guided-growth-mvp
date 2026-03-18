import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SECTION_LABEL_CLASS, toggleSetItem } from '@/components/onboarding/constants';
import { DeleteHabitModal } from '@/components/onboarding/DeleteHabitModal';
import { VoiceEditCard } from '@/components/onboarding/VoiceEditCard';
import { DayPicker } from '@/components/ui/DayPicker';
import { TimePicker } from '@/components/ui/TimePicker';

interface EditHabitState {
  habitIndex: number;
  habitName: string;
  days: number[];
  time: string;
}

const FIELD_LABEL_CLASS =
  'px-[4px] text-[12px] font-semibold uppercase leading-[16px] tracking-[0.6px] text-[#6b7280]';

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

  const [name, setName] = useState(state.habitName);
  const [time, setTime] = useState(state.time || '21:45');
  const [days, setDays] = useState<Set<number>>(new Set(state.days));
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const habitIndex = state.habitIndex;

  function handleSave() {
    navigate('/onboarding/advanced-results', {
      state: { updatedHabit: { index: habitIndex, name, time, days: Array.from(days) } },
    });
  }

  function handleDelete() {
    navigate('/onboarding/advanced-results', { state: { deletedIndex: habitIndex } });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f9f9f9]">
      {/* Header */}
      <div className="flex items-center justify-between bg-[rgba(249,249,249,0.8)] px-[24px] py-[16px] backdrop-blur-[6px]">
        <button
          type="button"
          onClick={() => navigate('/onboarding/advanced-results')}
          className="flex size-[40px] items-center"
        >
          <Icon icon="ic:round-arrow-back" width={24} height={24} className="text-[#0f172a]" />
        </button>
        <span className="text-[18px] font-bold leading-[28px] text-[#111827]">Edit Habit</span>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="flex size-[40px] items-center justify-end"
        >
          <Icon
            icon="material-symbols:delete-outline"
            width={24}
            height={24}
            className="text-[#e5484d]"
          />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-[32px] overflow-y-auto px-[24px] pb-[128px] pt-[16px]">
        {/* Form Fields */}
        <div className="flex flex-col gap-[24px]">
          {/* Habit Name */}
          <div className="flex flex-col gap-[8px]">
            <label className={FIELD_LABEL_CLASS}>Habit Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[12px] border border-[#e5e7eb] bg-white px-[17px] py-[15px] text-[16px] font-medium leading-[24px] text-[#1f2937] outline-none"
            />
          </div>

          {/* When? */}
          <div className="flex flex-col gap-[16px]">
            <span className={SECTION_LABEL_CLASS}>When?</span>
            <div className="flex w-full items-center justify-between rounded-[24px] border border-[#135bec] bg-[rgba(19,91,236,0.05)] px-[21px] py-[15px]">
              <TimePicker value={time} onChange={setTime} />
              <Icon icon="ic:round-access-time" width={20} height={20} className="text-[#135bec]" />
            </div>
          </div>

          {/* How Often? */}
          <div className="flex flex-col gap-[12px]">
            <label className={FIELD_LABEL_CLASS}>How Often?</label>
            <div className="rounded-[12px] border border-[#e5e7eb] bg-white px-[13px] py-[13px]">
              <DayPicker
                selectedDays={days}
                onToggleDay={(day) => setDays((prev) => toggleSetItem(prev, day))}
              />
            </div>
          </div>
        </div>

        <VoiceEditCard />
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-t from-[#f9f9f9] via-[rgba(249,249,249,0.95)] to-transparent p-[24px] px-[24px]">
        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-full bg-[#135bec] py-[16px] text-center text-[16px] font-bold text-white shadow-[0px_10px_15px_-3px_#bfdbfe,0px_4px_6px_-4px_#bfdbfe]"
        >
          Save Changes
        </button>
      </div>

      {showDeleteModal && (
        <DeleteHabitModal onDelete={handleDelete} onKeep={() => setShowDeleteModal(false)} />
      )}
    </div>
  );
}

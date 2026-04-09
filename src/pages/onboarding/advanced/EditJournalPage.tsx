import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { WEEKDAYS, WEEKEND, ALL_DAYS, SECTION_LABEL_CLASS, toggleSetItem } from '@/components/onboarding/constants';
import { DeleteHabitModal } from '@/components/onboarding/DeleteHabitModal';
import { SchedulePicker } from '@/components/onboarding/SchedulePicker';
import type { ScheduleOption } from '@/components/onboarding/SchedulePicker';
import { DayPicker } from '@/components/ui/DayPicker';
import { formatTime12, TimePickerSheet } from '@/components/ui/TimePicker';

interface EditJournalState {
  journalName: string;
  prompts: string[];
  time: string;
  schedule: ScheduleOption;
  days: number[];
  returnTo?: string;
}

const FIELD_LABEL_CLASS =
  'px-[4px] text-[12px] font-semibold uppercase leading-[16px] tracking-[0.6px] text-content-muted';

const SCHEDULE_DAYS: Record<ScheduleOption, Set<number>> = {
  Weekday: WEEKDAYS,
  Weekend: WEEKEND,
  'Every day': ALL_DAYS,
};

export function EditJournalPage() {
  const location = useLocation();
  const state = location.state as EditJournalState | null;

  if (!state) {
    return <Navigate to="/onboarding/advanced-step-6" replace />;
  }

  return <EditJournalForm state={state} />;
}

function EditJournalForm({ state }: { state: EditJournalState }) {
  const navigate = useNavigate();
  const returnTo = state.returnTo ?? '/onboarding/advanced-step-6';

  const [journalName, setJournalName] = useState(state.journalName);
  const [prompts, setPrompts] = useState<string[]>(state.prompts);
  const [newPrompt, setNewPrompt] = useState('');
  const [time, setTime] = useState(state.time || '21:45');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleOption>(state.schedule || 'Weekday');
  const [days, setDays] = useState<Set<number>>(new Set(state.days));
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleScheduleChange(s: ScheduleOption) {
    setSchedule(s);
    setDays(SCHEDULE_DAYS[s]);
  }

  function handleAddPrompt() {
    const trimmed = newPrompt.trim();
    if (!trimmed) return;
    setPrompts((p) => [...p, trimmed]);
    setNewPrompt('');
  }

  function handleDeletePrompt(index: number) {
    setPrompts((p) => p.filter((_, i) => i !== index));
  }

  function handlePromptChange(index: number, value: string) {
    setPrompts((p) => p.map((item, i) => (i === index ? value : item)));
  }

  function handleSave() {
    if (!journalName.trim()) return;
    navigate(returnTo, {
      state: {
        updatedJournal: {
          journalName: journalName.trim(),
          prompts,
          time,
          schedule,
          days: Array.from(days),
        },
      },
    });
  }

  function handleDelete() {
    navigate(returnTo, { state: { deletedJournal: true } });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-secondary/80 px-6 py-[16px] backdrop-blur-[6px]">
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          className="flex size-[40px] items-center"
        >
          <Icon icon="ic:round-arrow-back" width={24} height={24} className="text-content" />
        </button>
        <span className="text-[18px] font-bold leading-[28px] text-content">Edit Journal</span>
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
        <div className="flex flex-col gap-[24px]">
          {/* Journal Name */}
          <div className="flex flex-col gap-[8px]">
            <label className={FIELD_LABEL_CLASS}>Journal Name</label>
            <input
              type="text"
              value={journalName}
              onChange={(e) => setJournalName(e.target.value)}
              maxLength={100}
              className="w-full rounded-[12px] border border-border bg-surface px-[17px] py-[15px] text-[16px] font-medium leading-[24px] text-content outline-none"
            />
          </div>

          {/* Prompts */}
          <div className="flex flex-col gap-[16px]">
            <span className="text-[14px] font-bold uppercase tracking-[0.35px] text-content">
              {`You'll answer ${prompts.length} quick question${prompts.length !== 1 ? 's' : ''}:`}
            </span>
            <div className="flex flex-col gap-[12px]">
              {prompts.map((prompt, index) => (
                <div key={index} className="flex items-center">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(index, e.target.value)}
                    className="flex-1 rounded-[12px] border border-border bg-surface px-[17px] py-[13px] text-[16px] font-medium leading-[24px] text-content shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePrompt(index)}
                    className="flex shrink-0 items-center justify-center p-[8px]"
                    aria-label="Delete prompt"
                  >
                    <Icon
                      icon="ic:round-close"
                      width={16}
                      height={16}
                      className="text-content-muted"
                    />
                  </button>
                </div>
              ))}

              {/* Add new prompt */}
              <input
                type="text"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPrompt();
                  }
                }}
                onBlur={handleAddPrompt}
                placeholder="Or add your new prompt here..."
                className="w-full rounded-[12px] border border-border bg-surface px-[17px] py-[15px] text-[16px] font-normal leading-[24px] text-content placeholder:text-content-muted shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] outline-none"
              />

              <p className="text-[12px] font-normal leading-[16px] text-content-muted">
                Tap the text to change your prompts
              </p>
            </div>
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

          {/* Schedule */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold leading-[20px] text-content-muted">
              Schedule:
            </span>
            <SchedulePicker value={schedule} onChange={handleScheduleChange} />
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
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-t from-surface-secondary via-surface-secondary/95 to-transparent px-6 py-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!journalName.trim()}
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

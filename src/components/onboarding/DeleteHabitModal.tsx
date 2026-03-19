import { Icon } from '@iconify/react';

interface DeleteHabitModalProps {
  onDelete: () => void;
  onKeep: () => void;
}

export function DeleteHabitModal({ onDelete, onKeep }: DeleteHabitModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onKeep} />
      <div className="relative mx-[32px] flex flex-col items-center rounded-[24px] bg-white p-[32px] shadow-[0px_10px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]">
        <div className="mb-[16px] rounded-full bg-[#fef2f2] p-[16px]">
          <Icon
            icon="material-symbols:delete-outline"
            width={32}
            height={32}
            className="text-[#e5484d]"
          />
        </div>
        <h2 className="mb-[11px] text-center text-[24px] font-bold leading-[32px] tracking-[-0.6px] text-content">
          Delete Habit?
        </h2>
        <p className="mb-[32px] px-[8px] text-center text-[15px] font-normal leading-[24px] text-content-muted">
          Are you sure you want to delete this habit? This action cannot be undone
        </p>
        <div className="flex w-full flex-col gap-[12px]">
          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-full bg-[#e5484d] py-[16px] text-center text-[16px] font-bold text-white"
          >
            Delete Habit
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="w-full rounded-full border-2 border-primary py-[18px] text-center text-[16px] font-bold text-primary"
          >
            Keep Habit
          </button>
        </div>
      </div>
    </div>
  );
}

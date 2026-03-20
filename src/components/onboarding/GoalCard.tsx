import { Icon } from '@iconify/react';

interface GoalCardProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function GoalCard({ label, selected, disabled, onToggle }: GoalCardProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      className={`flex w-full items-center justify-between rounded-[24px] border px-[16px] py-[14px] transition-all duration-200 ${
        selected
          ? 'cursor-pointer border-primary bg-white shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]'
          : disabled
            ? 'border-transparent bg-[#f8f9fb]'
            : 'cursor-pointer border-border bg-white shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]'
      }`}
    >
      <span
        className={`text-[16px] font-bold leading-[24px] transition-colors duration-200 ${
          disabled ? 'text-content-secondary/50' : 'text-content'
        }`}
      >
        {label}
      </span>
      {!disabled && (
        <div
          className={`flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
            selected ? 'border-primary bg-primary' : 'border-primary'
          }`}
        >
          {selected && <Icon icon="ic:round-check" width={14} height={14} className="text-white" />}
        </div>
      )}
    </button>
  );
}

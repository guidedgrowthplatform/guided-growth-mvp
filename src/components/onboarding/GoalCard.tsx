import { Icon } from '@iconify/react';

interface GoalCardProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function GoalCard({ label, selected, onToggle }: GoalCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full cursor-pointer items-center justify-between rounded-[24px] border bg-white px-[16px] py-[14px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)] ${
        selected ? 'border-primary' : 'border-border'
      }`}
    >
      <span className="text-[16px] font-bold leading-[24px] text-content">{label}</span>
      <div className="flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 border-primary">
        {selected && <Icon icon="ic:round-check" width={16} height={16} className="text-primary" />}
      </div>
    </button>
  );
}

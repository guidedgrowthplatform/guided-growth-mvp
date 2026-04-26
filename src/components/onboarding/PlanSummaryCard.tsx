import { Icon } from '@iconify/react';

interface PlanSummaryCardProps {
  icon: string;
  typeLabel: 'Habit' | 'Reflection';
  title: string;
  cadence: string;
  rule: string;
  onEdit?: () => void;
}

export function PlanSummaryCard({
  icon,
  typeLabel,
  title,
  cadence,
  rule,
  onEdit,
}: PlanSummaryCardProps) {
  return (
    <div className="flex gap-[16px] rounded-[16px] border border-border-light bg-surface-secondary p-[21px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] bg-primary/10">
        <Icon icon={icon} className="size-[22px] text-primary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.3px] text-primary">
          {typeLabel}
        </span>
        <span className="text-[18px] font-bold leading-[28px] text-content">{title}</span>
        <p className="pt-[4px] text-[14px] leading-[22px]">
          <span className="font-medium text-content-subtle">Cadence:</span>{' '}
          <span className="text-content-secondary">{cadence}</span>
          <span className="text-content-secondary"> · </span>
          <span className="font-medium text-content-subtle">Rule:</span>{' '}
          <span className="text-content-secondary">{rule}</span>
        </p>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-surface-secondary text-content-secondary transition-colors hover:bg-primary/10 hover:text-primary"
          aria-label={`Edit ${title}`}
        >
          <Icon icon="mdi:pencil-outline" className="size-[18px]" />
        </button>
      )}
    </div>
  );
}

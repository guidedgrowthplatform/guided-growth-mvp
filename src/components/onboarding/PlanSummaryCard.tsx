import { Icon } from '@iconify/react';

interface PlanSummaryCardProps {
  icon: string;
  typeLabel: 'Habit' | 'Journal';
  title: string;
  cadence: string;
  rule: string;
}

export function PlanSummaryCard({ icon, typeLabel, title, cadence, rule }: PlanSummaryCardProps) {
  return (
    <div className="flex gap-[16px] rounded-[16px] border border-[#f1f5f9] bg-white p-[21px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[rgba(19,91,236,0.1)]">
        <Icon icon={icon} className="size-[22px] text-[#135bec]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-[12px] font-semibold uppercase tracking-[0.3px] text-[#135bec]">
          {typeLabel}
        </span>
        <span className="text-[18px] font-bold leading-[28px] text-[#0f172a]">{title}</span>
        <p className="pt-[4px] text-[14px] leading-[22px]">
          <span className="font-medium text-[#334155]">Cadence:</span>{' '}
          <span className="text-[#64748b]">{cadence}</span>
          <span className="text-[#64748b]"> · </span>
          <span className="font-medium text-[#334155]">Rule:</span>{' '}
          <span className="text-[#64748b]">{rule}</span>
        </p>
      </div>
    </div>
  );
}

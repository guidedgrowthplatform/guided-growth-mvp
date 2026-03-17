import { Icon } from '@iconify/react';

interface OnboardingTooltipProps {
  title: string;
  message: string;
}

export function OnboardingTooltip({ title, message }: OnboardingTooltipProps) {
  return (
    <div className="relative overflow-clip rounded-[16px] border border-[rgba(191,219,254,0.5)] bg-[#eff6ff] p-[21px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
      <div className="absolute -right-[40px] -top-[40px] size-[96px] rounded-full bg-[rgba(255,255,255,0.4)] blur-[32px]" />
      <div className="relative flex flex-col gap-[8px]">
        <div className="flex items-center gap-[10px]">
          <div className="rounded-[8px] bg-[#135bec] p-[6px]">
            <Icon icon="ic:round-info" className="size-[16px] text-white" />
          </div>
          <span className="text-[16px] font-bold leading-[24px] text-[#135bec]">{title}</span>
        </div>
        <p className="text-[12px] font-normal leading-[19.5px] text-[#6b7280]">{message}</p>
      </div>
    </div>
  );
}

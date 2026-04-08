import { Icon } from '@iconify/react';

interface SelectionCardProps {
  icon: string;
  iconBg: string;
  iconColor?: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  showSparkle?: boolean;
  badge?: string;
}

export function SelectionCard({
  icon,
  iconBg,
  iconColor = '#135bec',
  title,
  description,
  selected,
  onSelect,
  showSparkle,
  badge,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-start gap-[16px] rounded-[16px] border border-border-light bg-white px-[21px] py-[28px] text-left shadow-[0px_4px_20px_-2px_rgba(19,91,236,0.05),0px_2px_10px_-2px_rgba(0,0,0,0.02)]"
    >
      <div
        className="relative flex size-[36px] shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        <Icon icon={icon} width={18} height={18} style={{ color: iconColor }} />
        {showSparkle && (
          <Icon
            icon="ic:round-auto-awesome"
            width={9}
            height={9}
            className="absolute -right-1 -top-1 text-[#7c3aed]"
          />
        )}
      </div>
      <div className="flex-1">
        <div className="text-[18px] font-bold leading-[22.5px] text-content">{title}</div>
        <div className="pt-[4px] text-[14px] font-medium leading-[19.25px] text-content-secondary">
          {description}
        </div>
        {badge && (
          <span className="mt-2 inline-block rounded-full bg-surface-secondary px-3 py-1 text-xs font-bold text-content-secondary">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 border-primary">
        {selected && <div className="size-[12px] rounded-full bg-primary" />}
      </div>
    </button>
  );
}

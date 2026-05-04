import { Icon } from '@iconify/react';

interface SelectionCardProps {
  icon?: string;
  iconBg?: string;
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
  iconColor = 'rgb(var(--color-primary))',
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
      className="flex w-full cursor-pointer items-center gap-[16px] rounded-[16px] border border-border bg-surface-secondary p-[21px] text-left"
    >
      {icon && (
        <div
          className="relative flex size-[44px] shrink-0 items-center justify-center rounded-[22px]"
          style={{ backgroundColor: iconBg }}
        >
          <Icon icon={icon} width={24} height={24} style={{ color: iconColor }} />
        </div>
      )}
      <div className="flex-1">
        <div className="text-[16px] font-bold leading-[22.5px] text-content">{title}</div>
        <div className="pt-[4px] text-[14px] font-medium leading-[19.25px] text-content-secondary">
          {description}
        </div>
        {badge && (
          <span className="mt-2 inline-block rounded-full bg-surface-secondary px-3 py-1 text-xs font-bold text-content-secondary">
            {badge}
          </span>
        )}
      </div>
      <div className="flex size-[28px] shrink-0 items-center justify-center rounded-full border-2 border-border">
        {selected && <div className="size-[14px] rounded-full bg-primary" />}
      </div>
    </button>
  );
}

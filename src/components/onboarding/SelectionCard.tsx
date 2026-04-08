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
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center gap-[16px] rounded-[16px] border border-border-light bg-surface p-[21px] text-left shadow-[0px_4px_20px_-2px_rgb(var(--color-primary)/0.05),0px_2px_10px_-2px_rgba(0,0,0,0.02)]"
    >
      <div
        className="relative flex size-[48px] shrink-0 items-center justify-center rounded-[24px]"
        style={{ backgroundColor: iconBg }}
      >
        <Icon icon={icon} width={23} height={23} style={{ color: iconColor }} />
        {showSparkle && (
          <Icon
            icon="ic:round-auto-awesome"
            width={9}
            height={9}
            className="absolute -right-1 -top-1 text-violet-500"
          />
        )}
      </div>
      <div className="flex-1">
        <div className="text-[18px] font-bold leading-[22.5px] text-content">{title}</div>
        <div className="pt-[4px] text-[14px] font-medium leading-[19.25px] text-content-secondary">
          {description}
        </div>
      </div>
      <div className="flex size-[28px] shrink-0 items-center justify-center rounded-full border-2 border-primary">
        {selected && <div className="size-[18px] rounded-full bg-primary" />}
      </div>
    </button>
  );
}

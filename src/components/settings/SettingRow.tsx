import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

interface SettingRowProps {
  icon: string;
  label: string;
  iconBg?: string;
  iconClass?: string;
  labelClass?: string;
  right?: ReactNode;
  onClick?: () => void;
  isFirst?: boolean;
}

export function SettingRow({
  icon,
  label,
  iconBg = 'bg-primary/5',
  iconClass = 'text-primary',
  labelClass,
  right,
  onClick,
  isFirst,
}: SettingRowProps) {
  const borderClass = isFirst ? '' : 'border-t border-border-light';
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className={`rounded-2xl p-2 ${iconBg}`}>
          <Icon icon={icon} width={24} className={iconClass} />
        </div>
        <span className={`text-base font-semibold ${labelClass || 'text-content'}`}>{label}</span>
      </div>
      {right && <div className="flex items-center">{right}</div>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center justify-between px-4 py-4 ${borderClass}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`flex w-full items-center justify-between px-4 py-4 ${borderClass}`}>
      {content}
    </div>
  );
}

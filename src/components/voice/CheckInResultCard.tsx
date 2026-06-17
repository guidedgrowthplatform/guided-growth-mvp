import type { ComponentType } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import type { CheckInDimension } from '@gg/shared/types';

export interface CheckInResultCardData {
  sleep: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  date: string;
}

interface Props extends CheckInResultCardData {
  eyebrow?: string;
}

// Read-only check-in receipt rendered inline below an AI ChatBubble.
// Visually attached: picks up the coach bubble's blue tint, tighter padding,
// no drop shadow, and a slim primary-colored top accent stripe so it reads as
// "card the coach just attached" rather than a separate floating sheet.
export function CheckInResultCard({
  sleep,
  mood,
  energy,
  stress,
  date,
  eyebrow = 'Today’s check-in',
}: Props) {
  const values: Record<CheckInDimension, number | null> = { sleep, mood, energy, stress };
  return (
    <div
      // Match ChatBubble's AI shape: same max-width (290px) and corner radius
      // (16px). No border, no shadow — the soft blue tint alone says "this
      // came from the coach." Normal mt/mb gaps so it sits as its own
      // beat under the bubble, not glued to it.
      className="mb-3 ml-0 mr-auto mt-2 w-full max-w-[340px] animate-bubble-in overflow-hidden rounded-[16px]"
      style={{
        backgroundImage:
          'linear-gradient(to bottom, rgba(19,91,236,0.10), rgba(19,91,236,0.04) 40%, rgba(255,255,255,0) 100%)',
      }}
    >
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary/80">
          {eyebrow}
        </span>
        <span className="text-[10px] font-semibold text-primary/60">{formatDate(date)}</span>
      </div>
      <div className="space-y-2 px-4 pb-3.5">
        {checkInDimensions.map((dim) => (
          <DimensionRow
            key={dim.key}
            label={dim.label}
            options={dim.options}
            selected={values[dim.key]}
          />
        ))}
      </div>
    </div>
  );
}

function DimensionRow({
  label,
  options,
  selected,
}: {
  label: string;
  options: {
    value: number;
    icon: ComponentType<{ color: string }>;
    label: string;
    color: string;
  }[];
  selected: number | null;
}) {
  const selectedOption = options.find((o) => o.value === selected) ?? null;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-[12px] font-medium text-content-secondary">{label}</p>
        {selectedOption ? (
          <p className="text-[11px] font-semibold" style={{ color: selectedOption.color }}>
            {selectedOption.label}
          </p>
        ) : (
          <p className="text-[11px] font-medium text-content-tertiary">—</p>
        )}
      </div>
      <div className="flex justify-between">
        {options.map((option) => (
          <Pip
            key={option.value}
            icon={option.icon}
            color={option.color}
            isSelected={selected === option.value}
          />
        ))}
      </div>
    </div>
  );
}

function Pip({
  icon: Icon,
  color,
  isSelected,
}: {
  icon: ComponentType<{ color: string }>;
  color: string;
  isSelected: boolean;
}) {
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
      style={{
        borderColor: color,
        backgroundColor: isSelected ? color : 'transparent',
        opacity: isSelected ? 1 : 0.45,
      }}
    >
      <Icon color={isSelected ? '#ffffff' : color} />
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[m - 1]} ${d}`;
}

import type { ComponentType } from 'react';

interface EmojiOptionButtonProps {
  icon: ComponentType<{ color: string }>;
  label: string;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}

export function EmojiOptionButton({
  icon: Icon,
  label,
  color,
  isSelected,
  onClick,
}: EmojiOptionButtonProps) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors"
        style={{
          borderColor: color,
          backgroundColor: isSelected ? `${color}1a` : 'rgb(var(--color-surface))',
        }}
      >
        <Icon color={color} />
      </div>
      <span className="text-[10px] text-content-secondary">{label}</span>
    </button>
  );
}

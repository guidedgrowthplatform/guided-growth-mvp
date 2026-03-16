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
        className="flex h-12 w-12 items-center justify-center rounded-full border shadow-[0px_2px_4px_0px_rgba(0,0,0,0.04)] transition-colors"
        style={{
          borderColor: color,
          backgroundColor: isSelected ? `${color}1a` : 'rgb(var(--color-surface))',
        }}
      >
        <Icon color={color} />
      </div>
      <span className="text-xs text-gray-500">{label}</span>
    </button>
  );
}

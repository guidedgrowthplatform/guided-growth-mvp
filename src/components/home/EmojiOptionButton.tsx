interface EmojiOptionButtonProps {
  emoji: string;
  label: string;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}

export function EmojiOptionButton({
  emoji,
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
          borderColor: isSelected ? color : 'rgb(var(--color-border))',
          backgroundColor: isSelected ? `${color}1a` : 'rgb(var(--color-surface))',
        }}
      >
        <span className="text-2xl">{emoji}</span>
      </div>
      <span className="text-[10px] text-content-secondary">{label}</span>
    </button>
  );
}

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-4 pt-8">
      <h2 className="text-xl font-bold text-content">{title}</h2>
      {actionLabel && onAction && (
        <button onClick={onAction} className="text-sm font-bold text-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

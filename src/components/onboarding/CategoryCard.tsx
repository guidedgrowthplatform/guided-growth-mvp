interface CategoryCardProps {
  image?: string;
  emoji?: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function CategoryCard({ image, emoji, label, selected, onSelect }: CategoryCardProps) {
  if (image) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex cursor-pointer flex-col items-center gap-[4px]"
      >
        <div
          className={`h-[135px] w-full overflow-hidden rounded-[24px] border-2 ${selected ? 'border-primary' : 'border-transparent'}`}
        >
          <img src={image} alt={label} className="h-full w-full object-cover" />
        </div>
        <span className="text-center text-[14px] font-semibold leading-[17.5px] text-content">
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-[110px] cursor-pointer flex-col items-center justify-center gap-[10px] rounded-[20px] border-2 bg-surface-secondary p-[16px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] ${selected ? 'border-primary' : 'border-transparent'}`}
    >
      {emoji && <span className="text-[30px]">{emoji}</span>}
      <span className="text-center text-[14px] font-semibold leading-[17.5px] text-content">
        {label}
      </span>
    </button>
  );
}

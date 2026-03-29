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
        className={`relative h-[135px] w-full cursor-pointer overflow-hidden rounded-[24px] border-2 ${selected ? 'border-primary' : 'border-transparent'}`}
      >
        <img src={image} alt={label} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/60 to-transparent px-3 py-3">
          <span className="text-center text-[14px] font-semibold leading-[17.5px] text-white drop-shadow-md">
            {label}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-[110px] cursor-pointer flex-col items-center justify-center gap-[10px] rounded-[20px] border-2 bg-white p-[16px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] ${selected ? 'border-primary' : 'border-transparent'}`}
    >
      {emoji && <span className="text-[30px]">{emoji}</span>}
      <span className="text-center text-[14px] font-semibold leading-[17.5px] text-content">
        {label}
      </span>
    </button>
  );
}

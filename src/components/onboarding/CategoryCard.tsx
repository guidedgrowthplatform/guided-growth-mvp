interface CategoryCardProps {
  image: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

export function CategoryCard({ image, label, selected, onSelect }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative h-[135px] w-full overflow-hidden rounded-[24px] border-2 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] ${selected ? 'border-primary' : 'border-transparent'}`}
    >
      <img src={image} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute bottom-0 left-0 right-0 h-[40px] backdrop-blur-[2px]"
        style={{ background: 'rgba(217,217,217,0.05)' }}
      />
      <span className="absolute bottom-0 left-0 right-0 flex h-[40px] items-center justify-center text-[14px] font-semibold text-white [text-shadow:0px_4px_16px_rgba(0,0,0,0.25)]">
        {label}
      </span>
    </button>
  );
}

import { Share2, MoreHorizontal, X } from 'lucide-react';

interface HabitDetailHeaderProps {
  name: string;
  description: string;
  onClose: () => void;
}

export function HabitDetailTopBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 rounded-t-3xl bg-surface px-6 pb-2 pt-4">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
      <div className="flex items-center justify-end gap-2">
        <button className="rounded-full p-2" type="button">
          <Share2 size={20} className="text-content-secondary" />
        </button>
        <button className="rounded-full p-2" type="button">
          <MoreHorizontal size={20} className="text-content-secondary" />
        </button>
        <button className="rounded-full p-2" type="button" onClick={onClose}>
          <X size={20} className="text-content-secondary" />
        </button>
      </div>
    </div>
  );
}

export function HabitDetailTitle({
  name,
  description,
}: Pick<HabitDetailHeaderProps, 'name' | 'description'>) {
  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-normal text-content">{name}</h1>
      <p className="pb-1 pt-1 text-sm font-medium leading-[22px] text-content-secondary">
        {description}
      </p>
    </div>
  );
}

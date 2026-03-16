import { Share2, MoreHorizontal, X } from 'lucide-react';

interface HabitDetailHeaderProps {
  name: string;
  description: string;
  onClose: () => void;
}

export function HabitDetailTopBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 rounded-t-3xl bg-white px-6 pb-2 pt-4">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#e2e8f0]" />
      <div className="flex items-center justify-end gap-2">
        <button className="rounded-full p-2" type="button">
          <Share2 size={20} className="text-[#64748b]" />
        </button>
        <button className="rounded-full p-2" type="button">
          <MoreHorizontal size={20} className="text-[#64748b]" />
        </button>
        <button className="rounded-full p-2" type="button" onClick={onClose}>
          <X size={20} className="text-[#64748b]" />
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
      <h1 className="text-[28px] font-semibold leading-normal text-[#0f172a]">{name}</h1>
      <p className="mb-2 mt-2 text-sm font-medium leading-[22px] text-[#64748b]">{description}</p>
    </div>
  );
}

import { MoreHorizontal, X, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface HabitDetailHeaderProps {
  name: string;
  description: string;
  onClose: () => void;
}

export function HabitDetailTopBar({
  onClose,
  onDelete,
}: {
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <div className="sticky top-0 z-10 rounded-t-3xl bg-surface px-6 pb-2 pt-4">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
      <div className="flex items-center justify-end gap-2">
        {/* Three-dot menu with delete */}
        <div className="relative" ref={menuRef}>
          <button className="rounded-full p-2" type="button" onClick={() => setShowMenu((v) => !v)}>
            <MoreHorizontal size={20} className="text-content-secondary" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-border-light bg-surface py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onDelete?.();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/5"
              >
                <Trash2 size={16} />
                Delete Habit
              </button>
            </div>
          )}
        </div>
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

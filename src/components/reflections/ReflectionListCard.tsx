import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import type { JournalEntry } from '@shared/types';
import { entryHeading, formatListLabel, previewText, truncate } from './reflectionFormatters';

interface ReflectionListCardProps {
  entry: JournalEntry;
  isMenuOpen: boolean;
  onMenuToggle: (entry: JournalEntry) => void;
  onMenuClose: () => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
}

export function ReflectionListCard({
  entry,
  isMenuOpen,
  onMenuToggle,
  onMenuClose,
  onEdit,
  onDelete,
}: ReflectionListCardProps) {
  const navigate = useNavigate();

  return (
    <article
      onClick={() => navigate(`/reflections/${entry.id}`)}
      className="cursor-pointer rounded-2xl bg-surface px-4 py-4 shadow-card active:bg-surface-secondary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wider text-content">
            {formatListLabel(entry.created_at)}
          </p>
          <p className="mt-1 text-sm font-bold text-content">{entryHeading(entry)}</p>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Reflection actions"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle(entry);
            }}
            className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-surface-secondary"
          >
            <Icon icon="mdi:dots-horizontal" width={20} height={20} />
          </button>
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuClose();
                }}
              />
              <div
                role="menu"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-8 z-50 w-32 overflow-hidden rounded-lg bg-surface-secondary shadow-[0_6px_18px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(entry);
                  }}
                  className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-sm font-medium text-content"
                >
                  <Icon icon="mdi:pencil-outline" width={16} height={16} />
                  Edit
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry);
                  }}
                  className="flex w-full items-center gap-1.5 px-4 py-3 text-left text-sm font-medium text-danger"
                >
                  <Icon icon="mdi:trash-can-outline" width={16} height={16} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-content-secondary">
        {truncate(previewText(entry))}
      </p>
    </article>
  );
}

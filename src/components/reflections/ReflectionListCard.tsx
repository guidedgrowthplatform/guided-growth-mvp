import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import type { JournalEntry } from '@shared/types';
import {
  entryHeading,
  formatListLabel,
  previewText,
  truncate,
} from './reflectionFormatters';

interface ReflectionListCardProps {
  entry: JournalEntry;
  onMenuOpen: (entry: JournalEntry) => void;
}

export function ReflectionListCard({ entry, onMenuOpen }: ReflectionListCardProps) {
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
        <button
          type="button"
          aria-label="Reflection actions"
          onClick={(e) => {
            e.stopPropagation();
            onMenuOpen(entry);
          }}
          className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-secondary hover:bg-surface-secondary"
        >
          <Icon icon="mdi:dots-horizontal" width={20} height={20} />
        </button>
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-content-secondary">
        {truncate(previewText(entry))}
      </p>
    </article>
  );
}

import { useNavigate } from 'react-router-dom';
import { formatRelativeDateTime } from '@/utils/dates';
import { getEntryPreview } from '@/utils/entryPreview';
import type { JournalEntry } from '@shared/types';
import { getMoodPreset } from './constants';
import { ReflectionOverflowMenu } from './ReflectionOverflowMenu';

interface ReflectionListCardProps {
  entry: JournalEntry;
  onDelete: (entry: JournalEntry) => void;
}

export function ReflectionListCard({ entry, onDelete }: ReflectionListCardProps) {
  const navigate = useNavigate();
  const mood = getMoodPreset(entry.mood);
  const preview = getEntryPreview(entry);

  const openDetail = () => navigate(`/reflections/${entry.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
      className="relative flex flex-col gap-4 rounded-[32px] border border-border-light/30 bg-surface-secondary p-6 pr-16 transition-shadow hover:shadow-card"
    >
      <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
        <ReflectionOverflowMenu
          onEdit={() => navigate(`/reflections/${entry.id}/edit`)}
          onDelete={() => onDelete(entry)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-primary-light">
          {formatRelativeDateTime(entry.created_at)}
        </span>
        {mood && (
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{mood.emoji}</span>
            <span className="text-sm font-semibold text-content">{mood.label}</span>
          </div>
        )}
      </div>

      {preview && <p className="line-clamp-4 text-base leading-relaxed text-content">{preview}</p>}
    </div>
  );
}

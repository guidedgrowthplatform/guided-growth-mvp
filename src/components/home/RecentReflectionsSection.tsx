import { useNavigate } from 'react-router-dom';
import { useReflections } from '@/hooks/useReflections';
import { formatRelativeDateTime } from '@/utils/dates';
import { getEntryPreview } from '@/utils/entryPreview';
import { SectionHeader } from './SectionHeader';

const HOME_LIMIT = 3;

export function RecentReflectionsSection() {
  const navigate = useNavigate();
  const { entries, isLoading, error } = useReflections({ limit: HOME_LIMIT });

  if (error) return null;
  if (!isLoading && entries.length === 0) return null;

  return (
    <div>
      <SectionHeader
        title="Recent Reflections"
        actionLabel="See all"
        onAction={() => navigate('/reflections')}
      />
      {isLoading ? (
        <ReflectionPreviewSkeleton count={HOME_LIMIT} />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const preview = getEntryPreview(entry);
            return (
              <button
                key={entry.id}
                onClick={() => navigate(`/reflections/${entry.id}`)}
                className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-4 text-left transition-shadow hover:shadow-card"
              >
                <span className="text-sm font-semibold text-content">
                  {formatRelativeDateTime(entry.created_at)}
                </span>
                {preview && (
                  <p className="line-clamp-2 text-sm text-content-secondary">{preview}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReflectionPreviewSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-surface-secondary p-4"
        >
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
          <div className="bg-surface-raised relative h-4 w-1/3 rounded" />
          <div className="bg-surface-raised relative h-3 w-5/6 rounded" />
          <div className="bg-surface-raised relative h-3 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

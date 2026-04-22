import { Icon } from '@iconify/react';

interface AiInsightCardProps {
  insight: string | null;
  isLoading: boolean;
}

export function AiInsightCard({ insight, isLoading }: AiInsightCardProps) {
  if (!isLoading && !insight) return null;

  return (
    <div className="rounded-[24px] border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-primary-light">AI Insight</p>
        <Icon icon="ph:sparkle-fill" width={18} height={18} className="text-primary-light" />
      </div>
      <div className="mt-2">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <div className="relative h-3 w-full overflow-hidden rounded bg-surface">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
            </div>
            <div className="relative h-3 w-5/6 overflow-hidden rounded bg-surface">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-content">{insight}</p>
        )}
      </div>
    </div>
  );
}

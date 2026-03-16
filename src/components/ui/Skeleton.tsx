interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded bg-gradient-to-r from-border via-border-light to-border bg-[length:200%_100%] ${className}`}
    />
  );
}

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function TimeBadge({ children }: Props) {
  return (
    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
      {children}
    </span>
  );
}

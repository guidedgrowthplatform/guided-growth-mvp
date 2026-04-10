import type { ReactNode } from 'react';

interface InfoBoxProps {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

export function InfoBox({ icon, children, className = '' }: InfoBoxProps) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-primary/10 p-4 shadow-sm ${className}`}>
      <span className="mt-0.5 flex-shrink-0 text-primary">{icon}</span>
      <p className="text-sm text-primary">{children}</p>
    </div>
  );
}

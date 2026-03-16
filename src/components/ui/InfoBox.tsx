import type { ReactNode } from 'react';

interface InfoBoxProps {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

export function InfoBox({ icon, children, className = '' }: InfoBoxProps) {
  return (
    <div className={`flex items-start gap-3 bg-[#e3f2fd] p-4 ${className}`}>
      <span className="mt-0.5 flex-shrink-0 text-[#1565c0]">{icon}</span>
      <p className="text-sm text-[#1565c0]">{children}</p>
    </div>
  );
}

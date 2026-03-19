import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function SettingsCard({ children }: Props) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
      {children}
    </div>
  );
}

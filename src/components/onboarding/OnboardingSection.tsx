import type { ReactNode } from 'react';

interface OnboardingSectionProps {
  label: string;
  children: ReactNode;
}

export function OnboardingSection({ label, children }: OnboardingSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[18px] font-semibold leading-[28px] text-content">{label}</h2>
      {children}
    </div>
  );
}

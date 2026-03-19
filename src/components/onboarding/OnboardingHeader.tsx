interface OnboardingHeaderProps {
  title: string;
  subtitle: string;
}

export function OnboardingHeader({ title, subtitle }: OnboardingHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[28px] font-bold leading-[35px] tracking-[-0.5px] text-content">
        {title}
      </h1>
      <p className="text-[18px] font-medium leading-[28px] text-content-secondary">{subtitle}</p>
    </div>
  );
}

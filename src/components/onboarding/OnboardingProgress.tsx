interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="pb-4">
      <p className="mb-2 text-[14px] font-medium leading-[22px] tracking-[0.21px] text-content-secondary">
        Step {currentStep} of {totalSteps}
      </p>
      <div className="flex gap-[8px]">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-[6px] flex-1 rounded-full ${
              i < currentStep ? 'bg-primary-dark' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

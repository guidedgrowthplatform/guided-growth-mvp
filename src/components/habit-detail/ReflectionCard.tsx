interface ReflectionCardProps {
  habitName: string;
  onLogReflection?: () => void;
}

export function ReflectionCard({ habitName, onLogReflection }: ReflectionCardProps) {
  return (
    <div className="rounded-2xl border border-border-light bg-white px-[21px] pb-[21px] pt-[13px] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
      <p className="text-sm font-medium leading-[22px] text-content">
        How do you feel about your progress towards forming the &ldquo;{habitName}&rdquo; habit?
      </p>
      <button
        type="button"
        onClick={onLogReflection}
        className="mt-4 w-full rounded-full bg-primary py-3 text-center text-base font-bold text-white shadow-[0px_10px_15px_-3px_rgba(25,120,229,0.2),0px_4px_6px_-4px_rgba(25,120,229,0.2)]"
      >
        Log Habit Reflection
      </button>
    </div>
  );
}

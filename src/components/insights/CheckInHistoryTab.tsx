import type { useCheckInHistory } from '@/hooks/useCheckInHistory';
import { CheckInDateGroup } from './CheckInDateGroup';
import { DateFilterBar } from './DateFilterBar';

type CheckInHistoryHookResult = ReturnType<typeof useCheckInHistory>;

export function CheckInHistoryTab({ history }: { history: CheckInHistoryHookResult }) {
  const { groups, availableMonths, selectedMonth, setSelectedMonth, isLoading, error } = history;

  return (
    <div className="flex flex-col gap-4">
      <DateFilterBar
        availableMonths={availableMonths}
        selected={selectedMonth}
        onSelect={setSelectedMonth}
      />
      <h2 className="text-[18px] font-bold leading-7 text-content">Check-in Entries</h2>

      {error && (
        <div className="rounded-lg bg-danger/10 p-4 text-[14px] text-danger">
          Failed to load check-ins: {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-content-tertiary">
          No check-ins for this month yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <CheckInDateGroup key={`${group.month}-${group.day}`} {...group} />
          ))}
        </div>
      )}
    </div>
  );
}

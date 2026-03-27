import { CheckInDateGroup } from './CheckInDateGroup';
import { DateFilterBar } from './DateFilterBar';
import { checkInHistoryData } from './insightsMockData';

export function CheckInHistoryTab() {
  return (
    <div className="flex flex-col gap-4">
      <DateFilterBar />
      <h2 className="text-[18px] font-bold leading-7 text-content">Check-in Entries</h2>
      <div className="flex flex-col gap-4">
        {checkInHistoryData.map((group) => (
          <CheckInDateGroup key={group.day} {...group} />
        ))}
      </div>
    </div>
  );
}

import { format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  HomeHeader,
  DateStrip,
  CheckInCard,
  QuickActionCards,
  HabitsSection,
  FeedbackButton,
  ReminderSheet,
} from '@/components/home';
import { useAuth } from '@/hooks/useAuth';
import type { EntriesMap } from '@shared/types';

// Mock entries for date strip activity dots
function buildMockEntries(): EntriesMap {
  const today = new Date();
  return {
    [format(today, 'yyyy-MM-dd')]: { '1': 'yes', '2': '8' },
    [format(subDays(today, 1), 'yyyy-MM-dd')]: { '1': 'yes' },
    [format(subDays(today, 2), 'yyyy-MM-dd')]: { '1': 'yes', '3': '30' },
  };
}

export function HomePage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReminders, setShowReminders] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const mockEntries = useMemo(() => buildMockEntries(), []);

  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there';

  return (
    <>
      <div className="space-y-6 pb-8 pt-2">
        <HomeHeader userName={firstName} />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={mockEntries}
        />
        <div>
          <QuickActionCards
            onCheckInPress={() => setShowCheckIn(!showCheckIn)}
            onJournalPress={() => {}}
          />
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showCheckIn ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <CheckInCard selectedDate={selectedDate} onClose={() => setShowCheckIn(false)} />
            </div>
          </div>
        </div>
        <HabitsSection selectedDate={selectedDate} />
        <FeedbackButton />
      </div>

      {showReminders && <ReminderSheet onClose={() => setShowReminders(false)} />}
    </>
  );
}

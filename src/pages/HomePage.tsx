import { format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import {
  HomeHeader,
  DateStrip,
  CheckInCard,
  HabitsSection,
  FeedbackButton,
  FloatingActions,
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
  const mockEntries = useMemo(() => buildMockEntries(), []);

  const fullName = user?.user_metadata?.full_name as string | undefined;
  const email = user?.email;
  const firstName = fullName?.split(' ')[0] ?? email?.split('@')[0] ?? 'there';

  return (
    <>
      <div className="space-y-6 pb-8 pt-2">
        <HomeHeader userName={firstName} />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={mockEntries}
        />
        <CheckInCard selectedDate={selectedDate} onReminderPress={() => setShowReminders(true)} />
        <HabitsSection selectedDate={selectedDate} />
        <FeedbackButton />
      </div>
      <FloatingActions />
      {showReminders && <ReminderSheet onClose={() => setShowReminders(false)} />}
    </>
  );
}

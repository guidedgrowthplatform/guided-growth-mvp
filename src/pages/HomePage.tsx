import { format, subDays } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useEntries } from '@/hooks/useEntries';
import type { EntriesMap } from '@shared/types';

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReminders, setShowReminders] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);

  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      start: format(subDays(today, 3), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, []);

  const { entries, load } = useEntries();

  useEffect(() => {
    load(dateRange.start, dateRange.end);
  }, [load, dateRange.start, dateRange.end]);

  const entriesForStrip: EntriesMap = entries;

  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <>
      <div className="space-y-6 pb-8 pt-2">
        <HomeHeader userName={displayName} />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={entriesForStrip}
        />
        <div>
          <QuickActionCards
            onCheckInPress={() => setShowCheckIn(!showCheckIn)}
            onJournalPress={() => navigate('/journal')}
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
      </div>

      {/* Feedback Button - Above Bottom Nav */}
      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-6 z-40">
        <FeedbackButton />
      </div>

      {showReminders && <ReminderSheet onClose={() => setShowReminders(false)} />}
    </>
  );
}

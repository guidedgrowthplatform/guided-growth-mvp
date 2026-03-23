import { format, subDays } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HomeHeader,
  DateStrip,
  CheckInCard,
  QuickActionCards,
  HabitsSection,
  FeedbackButton,
  FloatingActions,
  ReminderSheet,
} from '@/components/home';
import { QuickJournal } from '@/components/journal/QuickJournal';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useEntries } from '@/hooks/useEntries';
import { useJournal } from '@/hooks/useJournal';
import type { EntriesMap } from '@shared/types';

export function HomePage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReminders, setShowReminders] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [journalText, setJournalText] = useState('');
  const { save: saveJournal, saving: journalSaving } = useJournal();

  const handleSaveJournal = useCallback(async () => {
    if (!journalText.trim()) return;
    try {
      await saveJournal(journalText.trim());
      setJournalText('');
      setShowJournal(false);
      addToast('success', 'Journal entry saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save journal';
      addToast('error', msg);
    }
  }, [journalText, saveJournal, addToast]);

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

  useEffect(() => {
    const handler = () => setShowJournal((prev) => !prev);
    window.addEventListener('toggle-journal', handler);
    return () => window.removeEventListener('toggle-journal', handler);
  }, []);

  const fullName = user?.name ?? undefined;
  const email = user?.email;
  const firstName = fullName?.split(' ')[0] ?? email?.split('@')[0] ?? 'there';

  return (
    <>
      <div className="space-y-6 pb-8 pt-2">
        <HomeHeader userName={firstName} />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={entriesForStrip}
        />
        <div>
          <QuickActionCards
            onCheckInPress={() => setShowCheckIn(!showCheckIn)}
            onJournalPress={() => setShowJournal(!showJournal)}
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
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              showJournal ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <QuickJournal
                value={journalText}
                onChange={setJournalText}
                onSave={handleSaveJournal}
                isSaving={journalSaving}
                placeholder="What's on your mind today?"
              />
            </div>
          </div>
        </div>
        <HabitsSection selectedDate={selectedDate} />
        <FeedbackButton />
      </div>
      <FloatingActions />
      {showReminders && <ReminderSheet onClose={() => setShowReminders(false)} />}
    </>
  );
}

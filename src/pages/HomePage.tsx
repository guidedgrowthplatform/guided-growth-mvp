import { format, subDays, differenceInDays } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import {
  HomeHeader,
  DateStrip,
  CheckInCard,
  QuickActionCards,
  HabitsSection,
  RecentReflectionsSection,
  FeedbackButton,
  FeedbackSheet,
  ReminderSheet,
} from '@/components/home';
import { useDisplayName } from '@/hooks/useDisplayName';
import { useEntries } from '@/hooks/useEntries';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { speak } from '@/lib/services/tts-service';
import type { EntriesMap } from '@gg/shared/types';

// Pick the HOME-* variant the user is currently looking at. The auto-emitter
// can only resolve "/" to one alphabetically-first match (HOME-EVENING), so
// HomePage emits the correct sub-screen explicitly via useSessionLog.
function deriveHomeScreenId(fromOnboarding: boolean): string {
  if (fromOnboarding) return 'HOME-FIRST';
  return new Date().getHours() < 15 ? 'HOME-MORNING' : 'HOME-EVENING';
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { logEvent } = useSessionLog();
  const fromOnboarding = (location.state as { fromOnboarding?: boolean })?.fromOnboarding === true;
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReminders, setShowReminders] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const homeScreenId = useMemo(() => deriveHomeScreenId(fromOnboarding), [fromOnboarding]);

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

  const fromOnboardingAtMount = useRef(fromOnboarding);
  useEffect(() => {
    track('view_home', { from_onboarding: fromOnboardingAtMount.current });
    // Override the auto-emitter's alphabetic guess (HOME-EVENING) with the
    // actual HOME-* sub-screen the user is on.
    logEvent(
      'navigate',
      { from_screen: null, to_screen: homeScreenId, trigger: 'auto' },
      homeScreenId,
    );
  }, [homeScreenId, logEvent]);

  // CHECKIN-EXPANDED is a state of HomePage, not a route — fire an explicit
  // navigate + checkin_started when the overlay opens.
  useEffect(() => {
    if (showCheckIn) {
      logEvent(
        'navigate',
        { from_screen: homeScreenId, to_screen: 'HOME-MORNING-CHECKIN-EXPANDED', trigger: 'tap' },
        'HOME-MORNING-CHECKIN-EXPANDED',
      );
      const isMorning = new Date().getHours() < 15;
      logEvent(
        'checkin_started',
        { type: isMorning ? 'morning' : 'evening' },
        isMorning ? 'MCHECK-01' : 'ECHECK-01',
      );
    }
  }, [showCheckIn, homeScreenId, logEvent]);

  const displayName = useDisplayName('there');

  // Post-onboarding: auto-show ReminderSheet once
  useEffect(() => {
    if (fromOnboarding && !localStorage.getItem('gg_reminders_shown')) {
      setShowReminders(true);
      localStorage.setItem('gg_reminders_shown', 'true');
    }
  }, [fromOnboarding]);

  // Founding User Moment — per Voice Journey Spreadsheet v3 (line 579)
  // One-time voice after 7+ days of use
  const foundingMomentFired = useRef(false);
  useEffect(() => {
    if (foundingMomentFired.current) return;
    foundingMomentFired.current = true;
    const alreadyPlayed = localStorage.getItem('gg_founding_moment_played');
    if (alreadyPlayed) return;

    // Check account age via Supabase auth metadata
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        const createdAt = data?.user?.created_at;
        if (!createdAt) return;
        const daysActive = differenceInDays(new Date(), new Date(createdAt));
        if (daysActive >= 7) {
          localStorage.setItem('gg_founding_moment_played', 'true');
          setTimeout(() => {
            speak(
              `Hey ${displayName} \u2014 it's been a week. The fact that you're still here matters. Most people who try new apps stop after three days. You didn't. That's not the app \u2014 that's you.`,
            );
          }, 2000);
        }
      });
    });
  }, [displayName]);

  return (
    <>
      <div className="space-y-6 pb-8 pt-2">
        <HomeHeader
          userName={displayName}
          isFirstVisit={fromOnboarding}
          onPlusClick={() => {
            track('tap_add_habit', { source: 'home_header' });
            navigate('/add-habit');
          }}
        />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={entriesForStrip}
        />
        <div>
          <QuickActionCards
            onCheckInPress={() => {
              const next = !showCheckIn;
              if (next) {
                const hour = new Date().getHours();
                track('start_checkin', {
                  checkin_type: hour < 15 ? 'morning' : 'evening',
                  trigger: 'home_card',
                });
              }
              setShowCheckIn(next);
            }}
            onJournalPress={() => {
              navigate('/journal');
            }}
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
        <HabitsSection selectedDate={selectedDate} screenId={homeScreenId} />
        <RecentReflectionsSection />
      </div>

      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-6 z-20">
        <FeedbackButton onPress={() => setShowFeedback(true)} />
      </div>

      {showFeedback && <FeedbackSheet onClose={() => setShowFeedback(false)} />}

      {showReminders && (
        <ReminderSheet
          onClose={() => setShowReminders(false)}
          initialMorningTime={preferences.morningTime}
          initialNightTime={preferences.nightTime}
          initialPushNotifications={preferences.pushNotifications}
          onSave={(data) => updatePreferences(data)}
        />
      )}
    </>
  );
}

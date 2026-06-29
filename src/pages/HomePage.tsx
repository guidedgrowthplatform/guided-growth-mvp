import { format, subDays, differenceInDays } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import {
  HomeHeader,
  DateStrip,
  CheckinFlowOverlay,
  QuickActionCards,
  HabitsSection,
  RecentReflectionsSection,
  FeedbackButton,
  FeedbackSheet,
  ReminderSheet,
} from '@/components/home';
import { useCheckIn } from '@/hooks/useCheckIn';
import { useDisplayName } from '@/hooks/useDisplayName';
import { useEntries } from '@/hooks/useEntries';
import { useNotifications } from '@/hooks/useNotifications';
import { useReminderCheckinDeepLink } from '@/hooks/useReminderCheckinDeepLink';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { PERMISSIONS_SEEN_KEY } from '@/lib/permissions';
import { speak, unlockTTS } from '@/lib/services/tts-service';
import { currentCheckinType } from '@/utils/dates';
import type { EntriesMap } from '@gg/shared/types';

// Pick the HOME-* variant the user is currently looking at. The auto-emitter
// can only resolve "/" to one alphabetically-first match (HOME-EVENING), so
// HomePage emits the correct sub-screen explicitly via useSessionLog.
function deriveHomeScreenId(fromOnboarding: boolean): string {
  if (fromOnboarding) return 'HOME-FIRST';
  return currentCheckinType() === 'morning' ? 'HOME-MORNING' : 'HOME-EVENING';
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { logEvent } = useSessionLog();
  const fromOnboarding = (location.state as { fromOnboarding?: boolean })?.fromOnboarding === true;
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReminders, setShowReminders] = useState(false);
  const [showMorningFlow, setShowMorningFlow] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // today's row, not time-bucketed useCheckinEntry (flips to evening after 16:00)
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { checkIn: todayCheckin } = useCheckIn(todayStr, { type: 'morning' });
  const morningDone =
    !!todayCheckin &&
    (todayCheckin.sleep != null ||
      todayCheckin.mood != null ||
      todayCheckin.energy != null ||
      todayCheckin.stress != null);
  const homeScreenId = useMemo(() => deriveHomeScreenId(fromOnboarding), [fromOnboarding]);

  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      start: format(subDays(today, 3), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, []);

  const { entries, load } = useEntries();
  const { unreadCount } = useNotifications();

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
    if (showMorningFlow) {
      logEvent(
        'navigate',
        { from_screen: homeScreenId, to_screen: 'HOME-MORNING-CHECKIN-EXPANDED', trigger: 'tap' },
        'HOME-MORNING-CHECKIN-EXPANDED',
      );
      logEvent('checkin_started', { type: 'morning' }, 'MCHECK-01');
    }
  }, [showMorningFlow, homeScreenId, logEvent]);

  const displayName = useDisplayName('there');

  // Post-onboarding: auto-show ReminderSheet once
  useEffect(() => {
    if (fromOnboarding && !localStorage.getItem('gg_reminders_shown')) {
      setShowReminders(true);
      localStorage.setItem('gg_reminders_shown', 'true');
    }
  }, [fromOnboarding]);

  useReminderCheckinDeepLink();

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
          unreadCount={unreadCount}
          onBellClick={() =>
            navigate(
              localStorage.getItem(PERMISSIONS_SEEN_KEY) ? '/notifications' : '/enable-permissions',
            )
          }
        />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={entriesForStrip}
        />
        <QuickActionCards
          morningDone={morningDone}
          onCheckInPress={() => {
            unlockTTS(); // gesture-bound; required for iOS audio
            track('start_checkin', { checkin_type: 'morning', trigger: 'home_card' });
            setShowMorningFlow(true);
          }}
          onJournalPress={() => {
            navigate('/journal');
          }}
        />
        <HabitsSection selectedDate={selectedDate} screenId={homeScreenId} />
        <RecentReflectionsSection />
      </div>

      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-6 z-20">
        <FeedbackButton onPress={() => setShowFeedback(true)} />
      </div>

      {showMorningFlow && (
        <CheckinFlowOverlay
          flowId="morning-checkin-v1"
          alreadyDone={morningDone}
          onClose={() => setShowMorningFlow(false)}
        />
      )}

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

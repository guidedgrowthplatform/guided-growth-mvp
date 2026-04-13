import { format, subDays, differenceInDays } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeHeader,
  DateStrip,
  CheckInCard,
  QuickActionCards,
  HabitsSection,
  FeedbackButton,
  MuteToggle,
  FeedbackSheet,
  ReminderSheet,
  EveningCheckInFlow,
  FirstVisitWelcome,
} from '@/components/home';
import { useAuth } from '@/hooks/useAuth';
import { useEntries } from '@/hooks/useEntries';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { track } from '@/lib/analytics';
import { speak } from '@/lib/services/tts-service';
import type { EntriesMap } from '@shared/types';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();
  const fromOnboarding = (location.state as { fromOnboarding?: boolean })?.fromOnboarding === true;
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showReminders, setShowReminders] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showEveningFlow, setShowEveningFlow] = useState(false);
  const [showFirstVisit, setShowFirstVisit] = useState(fromOnboarding);

  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      start: format(subDays(today, 3), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    };
  }, []);

  const { entries, load } = useEntries();
  const voicePlayer = useVoicePlayer();

  useEffect(() => {
    load(dateRange.start, dateRange.end);
  }, [load, dateRange.start, dateRange.end]);

  // Pre-recorded dashboard greeting MP3 — plays morning or evening variant
  const dashboardGreetingPlayed = useRef(false);
  useEffect(() => {
    if (dashboardGreetingPlayed.current || fromOnboarding) return;
    dashboardGreetingPlayed.current = true;
    const hour = new Date().getHours();
    const fileId = hour < 15 ? 'dashboard_morning' : 'dashboard_evening';
    voicePlayer.play(fileId).catch(() => {
      // Autoplay blocked — will play on next user interaction
    });
  }, [voicePlayer, fromOnboarding]);

  const entriesForStrip: EntriesMap = entries;

  const displayName =
    user?.nickname || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // Post-onboarding: auto-show ReminderSheet once
  useEffect(() => {
    if (fromOnboarding && !localStorage.getItem('gg_reminders_shown')) {
      setShowReminders(true);
      localStorage.setItem('gg_reminders_shown', 'true');
    }
  }, [fromOnboarding]);

  // ── HOME-DAY2: Day 2 special moment (Voice Journey CSV) ───────────────
  // "Day two. You came back. That's the hardest step after the first one."
  // Triggers once on the second day the user opens the app.
  const day2Fired = useRef(false);
  useEffect(() => {
    if (day2Fired.current || fromOnboarding) return;
    day2Fired.current = true;
    if (localStorage.getItem('gg_day2_shown')) return;

    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        const createdAt = data?.user?.created_at;
        if (!createdAt) return;
        const daysActive = differenceInDays(new Date(), new Date(createdAt));
        if (daysActive === 1) {
          localStorage.setItem('gg_day2_shown', 'true');
          track('day_2_moment');
          setTimeout(() => {
            speak(
              `Day two. You came back. That's the hardest step after the first one. Let's keep it going.`,
            );
          }, 1500);
        }
      });
    });
  }, [fromOnboarding]);

  // ── HOME-RETURN: Return after 3+ days of inactivity ──────────────────
  // "Hey [Name]. It's been a few days. No judgment - life happens."
  // Triggers once per return after 3+ days away.
  const returnFired = useRef(false);
  useEffect(() => {
    if (returnFired.current || fromOnboarding) return;
    returnFired.current = true;

    const lastVisit = localStorage.getItem('gg_last_visit_date');
    const today = format(new Date(), 'yyyy-MM-dd');

    // Always update last visit
    localStorage.setItem('gg_last_visit_date', today);

    if (!lastVisit) return; // First visit or no tracking yet

    const daysSinceLastVisit = differenceInDays(new Date(today), new Date(lastVisit));

    if (daysSinceLastVisit >= 7) {
      track('user_return', { days_inactive: daysSinceLastVisit });
      setTimeout(() => {
        speak(
          `Hey ${displayName}. Welcome back. Everything's here just like you left it. Whenever you're ready.`,
        );
      }, 1500);
    } else if (daysSinceLastVisit >= 3) {
      track('user_return', { days_inactive: daysSinceLastVisit });
      setTimeout(() => {
        speak(
          `Hey ${displayName}. It's been a few days. No judgment, life happens. Want to pick up where you left off?`,
        );
      }, 1500);
    }
  }, [displayName, fromOnboarding]);

  // ── Founding User Moment — per Voice Journey CSV (ONBOARD-09) ────────
  // One-time voice after 7+ days of use
  const foundingMomentFired = useRef(false);
  useEffect(() => {
    if (foundingMomentFired.current) return;
    foundingMomentFired.current = true;
    const alreadyPlayed = localStorage.getItem('gg_founding_moment_played');
    if (alreadyPlayed) return;

    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        const createdAt = data?.user?.created_at;
        if (!createdAt) return;
        const daysActive = differenceInDays(new Date(), new Date(createdAt));
        if (daysActive >= 7) {
          localStorage.setItem('gg_founding_moment_played', 'true');
          track('founding_user_moment', { days_active: daysActive });
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
          onPlusClick={() => navigate('/add-habit')}
        />
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          entries={entriesForStrip}
        />
        {showFirstVisit && <FirstVisitWelcome onDismiss={() => setShowFirstVisit(false)} />}
        <div>
          <QuickActionCards
            onCheckInPress={() => {
              const hour = new Date().getHours();
              if (hour >= 17) {
                // Evening: launch full evening check-in flow (ECHECK-01)
                setShowEveningFlow(true);
              } else {
                // Morning/afternoon: toggle simple check-in card
                setShowCheckIn(!showCheckIn);
              }
            }}
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

      {/* Feedback & Mute — Above Bottom Nav */}
      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-6 z-40 flex items-center gap-2">
        <FeedbackButton onPress={() => setShowFeedback(true)} />
        <MuteToggle />
      </div>

      {showFeedback && <FeedbackSheet onClose={() => setShowFeedback(false)} />}
      {showEveningFlow && <EveningCheckInFlow onClose={() => setShowEveningFlow(false)} />}

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

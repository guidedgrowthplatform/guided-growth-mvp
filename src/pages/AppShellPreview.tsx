import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { type AppTab, HomeBarPreview } from '@/components/flow-designer/orb/HomeBarPreview';
import { OrbTuner } from '@/components/flow-designer/orb/OrbTuner';
import manifestData from '@/data/reset-manifest.json';
import { CalendarStatesPreview } from '@/pages/CalendarStatesPreview';
import { CoachSpeakingPreview } from '@/pages/CoachSpeakingPreview';
import { HabitTrendPreview } from '@/pages/HabitTrendPreview';
import { ResetLibraryPage } from '@/pages/ResetLibraryPage';
import { ResetNudgePreview } from '@/pages/ResetNudgePreview';
import { ScreenTimePreview } from '@/pages/ScreenTimePreview';
import { WeeklyCoachDetailPreview } from '@/pages/WeeklyCoachDetailPreview';

const resetManifest = (manifestData as { files: Record<string, { title: string }> }).files;

// The Reset tab's own little app: browse the Library, tap a track to open the
// coach-speaking player, or tap the reminders bell to open the nudge config.
function ResetTab() {
  const [view, setView] = useState<'browse' | 'player' | 'nudge'>('browse');
  const [trackId, setTrackId] = useState<string | null>(null);

  if (view === 'player') {
    return (
      <CoachSpeakingPreview
        trackTitle={trackId ? resetManifest[trackId]?.title : undefined}
        onBack={() => setView('browse')}
      />
    );
  }
  if (view === 'nudge') {
    return <ResetNudgePreview onBack={() => setView('browse')} />;
  }
  return (
    <MemoryRouter>
      <ResetLibraryPage
        onOpenTrack={(id) => {
          setTrackId(id);
          setView('player');
        }}
        onOpenNudge={() => setView('nudge')}
      />
    </MemoryRouter>
  );
}

// The "real app" shell: the 4 mandate features wired to a live bottom nav (the
// same orb + White/Glass/Floating bar the tuner drives), so Yair can switch
// navbar style and orb look while tapping between features -- one app, not a
// storyboard. Reuses OrbTuner's full control panel via its renderPreview hook.
// Cross-links: Screen Time's Set up opens the block flows; the Coach's per-habit
// rows jump to the Calendar tab's Habit trends for that habit.

const TABS: AppTab[] = [
  { icon: 'ph:hourglass-medium-bold', label: 'Screen' },
  { icon: 'ic:round-leaderboard', label: 'Coach' },
  { icon: 'ic:round-calendar-month', label: 'Calendar' },
  { icon: 'ph:waves-bold', label: 'Reset' },
];

export function AppShellPreview() {
  const [tab, setTab] = useState(0);
  // When set, the Calendar tab shows the Habit trends drill-down for this habit
  // (reached from the Coach's "Every habit" rows).
  const [habitTrend, setHabitTrend] = useState<string | null>(null);

  const goTab = (i: number) => {
    setTab(i);
    setHabitTrend(null);
  };

  const screen = (() => {
    switch (tab) {
      case 0:
        return <ScreenTimePreview />;
      case 1:
        return (
          <WeeklyCoachDetailPreview
            onHabitSelect={(h) => {
              setTab(2);
              setHabitTrend(h);
            }}
          />
        );
      case 2:
        return habitTrend ? (
          <HabitTrendPreview initialHabit={habitTrend} onBack={() => setHabitTrend(null)} />
        ) : (
          <CalendarStatesPreview />
        );
      case 3:
        return <ResetTab />;
      default:
        return null;
    }
  })();

  return (
    <OrbTuner
      renderPreview={(p) => (
        <HomeBarPreview
          {...p}
          label="App preview (live)"
          screen={screen}
          tabs={TABS}
          activeTab={tab}
          onTabChange={goTab}
        />
      )}
    />
  );
}

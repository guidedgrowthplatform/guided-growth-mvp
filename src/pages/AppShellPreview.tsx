import { Icon } from '@iconify/react';
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

// The "real app" shell: the 4 mandate features previewed on the SAME orb + bottom
// bar the tuner drives, so Yair can switch navbar style and orb look while moving
// between features. The feature switcher lives OUTSIDE the phone frame (a labelled
// "Mockups" control), so the phone keeps its real canonical bottom nav and nobody
// mistakes the preview switcher for a redesigned product bottom bar.
// Cross-links: Screen Time's Set up opens the block flows; the Coach's per-habit
// rows jump to the Calendar tab's Habit trends for that habit.

const TABS: AppTab[] = [
  { icon: 'ph:hourglass-medium-bold', label: 'Screen Time' },
  { icon: 'ic:round-leaderboard', label: 'Weekly Coach' },
  { icon: 'ic:round-calendar-month', label: 'Calendar' },
  { icon: 'ph:waves-bold', label: 'Reset Library' },
];

// The out-of-frame preview switcher. Explicitly labelled so it reads as a preview
// control, not a product bottom nav.
function MockupSwitcher({ active, onPick }: { active: number; onPick: (i: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: '#8a92a8', letterSpacing: '.09em' }}
      >
        Mockups &middot; tap to switch screen
      </span>
      <div className="flex flex-wrap justify-center gap-1 rounded-full border border-border-light bg-surface p-1 shadow-card">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => onPick(i)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-content-secondary"
            style={
              active === i ? { background: 'rgb(var(--color-primary))', color: '#fff' } : undefined
            }
          >
            <Icon icon={t.icon} width={16} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
          aboveFrame={<MockupSwitcher active={tab} onPick={goTab} />}
        />
      )}
    />
  );
}

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { BlockNowPreview } from '@/pages/BlockNowPreview';
import { BlockSchedulePreview } from '@/pages/BlockSchedulePreview';
import { RecoveryCalibrationPreview } from '@/pages/RecoveryCalibrationPreview';
import { ReflectionCheckInPreview } from '@/pages/ReflectionCheckInPreview';
import { SetupReasonsPreview } from '@/pages/SetupReasonsPreview';

// Standalone, auth-free design mock of the Screen Time feature (opt-in digital
// wellbeing / self-regulation, NEVER "parental controls"). Three key states via
// a top switcher: Set up (Apple picker opt-in), Usage (on-device per-app time +
// daily budgets), Blocked (the calm green shield, never red, always states the
// reason, offers a reset instead). The Set up tab also opens the two block
// flows (schedule / now). Route /__screentime. Mock only.

type STView =
  | 'setup'
  | 'usage'
  | 'blocked'
  | 'schedule'
  | 'blocknow'
  | 'reasons'
  | 'reflection'
  | 'recovery';

interface AppRow {
  label: string; // the user's OWN label -- app names never reach our code (spec)
  color: string;
  usedMin: number;
  budgetMin: number;
}

const APPS: AppRow[] = [
  { label: 'Socials', color: 'bg-violet-400', usedMin: 30, budgetMin: 30 },
  { label: 'Video', color: 'bg-rose-400', usedMin: 22, budgetMin: 45 },
  { label: 'News', color: 'bg-amber-400', usedMin: 12, budgetMin: 20 },
];

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function Switcher({ view, setView }: { view: STView; setView: (v: STView) => void }) {
  const tabs: { key: STView; label: string }[] = [
    { key: 'setup', label: 'Set up' },
    { key: 'usage', label: 'Usage' },
    { key: 'blocked', label: 'Blocked' },
  ];
  return (
    <div className="flex gap-1 rounded-full bg-surface-secondary p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setView(t.key)}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors ${
            view === t.key ? 'bg-surface text-content shadow-sm' : 'text-content-tertiary'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SetupView({ onOpen }: { onOpen: (v: STView) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl bg-surface p-6 shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Icon icon="ph:hourglass-medium-bold" width={26} className="text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-content">Spend less time where you choose</h2>
        <p className="mt-2 text-sm leading-relaxed text-content-secondary">
          Pick the apps you want a lighter hand with. You will see your own time on them, and set a
          daily limit. When you reach it, Guided Growth gently steps in for the rest of the day.
        </p>
        <button
          type="button"
          onClick={() => onOpen('reasons')}
          className="mt-5 w-full rounded-full bg-primary py-3.5 text-base font-bold text-white"
        >
          Choose apps
        </button>
        <p className="mt-3 text-center text-xs text-content-tertiary">
          One Face ID tap. Nothing leaves your phone.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {[
          ['ph:hand-pointing-bold', 'You choose the apps and the limits'],
          ['ph:device-mobile-bold', 'Your usage stays on your device, always'],
          ['ph:toggle-left-bold', 'Turn the whole thing off anytime in Settings'],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-center gap-3">
            <Icon icon={icon} width={20} className="shrink-0 text-primary" />
            <span className="text-sm text-content-secondary">{text}</span>
          </div>
        ))}
      </div>

      {/* The two ways to block, opened from Set up. */}
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-content-tertiary">
        Ways to block
      </p>
      <div className="flex flex-col gap-2.5">
        <SetupOption
          icon="ph:calendar-dots-bold"
          title="Block schedule"
          subtitle="Recurring lock on the days and times you pick"
          onClick={() => onOpen('schedule')}
        />
        <SetupOption
          icon="ph:lock-simple-bold"
          title="Block now"
          subtitle="Lock a few apps right away for a set time"
          onClick={() => onOpen('blocknow')}
        />
      </div>

      {/* The coaching moments: what makes this a coach, not a blocker. */}
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-content-tertiary">
        Coaching moments
      </p>
      <div className="flex flex-col gap-2.5">
        <SetupOption
          icon="ph:moon-stars-bold"
          title="Evening reflection"
          subtitle="A kept or missed boundary, beside how the evening felt"
          onClick={() => onOpen('reflection')}
        />
        <SetupOption
          icon="ph:compass-tool-bold"
          title="When a boundary slips"
          subtitle="The coach recalibrates the plan, never a red failure"
          onClick={() => onOpen('recovery')}
        />
      </div>
    </div>
  );
}

function SetupOption({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border-light bg-surface p-4 text-left shadow-sm transition-shadow active:shadow-card-hover"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon icon={icon} width={22} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-content">{title}</p>
        <p className="truncate text-xs text-content-secondary">{subtitle}</p>
      </div>
      <Icon icon="ic:round-chevron-right" width={20} className="shrink-0 text-content-tertiary" />
    </button>
  );
}

function UsageView() {
  const [range, setRange] = useState<'today' | 'week'>('today');
  const total = APPS.reduce((s, a) => s + a.usedMin, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 self-start rounded-full bg-surface-secondary p-1">
        {(['today', 'week'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${
              range === r ? 'bg-surface text-content shadow-sm' : 'text-content-tertiary'
            }`}
          >
            {r === 'today' ? 'Today' : 'This week'}
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-surface p-6 shadow-card">
        <p className="text-sm font-medium text-content-secondary">Time on your chosen apps</p>
        <p className="mt-1 text-4xl font-bold text-content">{fmt(total)}</p>
        <p className="mt-1 text-sm text-content-tertiary">
          {range === 'today' ? 'today' : 'this week, daily average'}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {APPS.map((a) => {
          const pct = Math.min(100, Math.round((a.usedMin / a.budgetMin) * 100));
          const over = a.usedMin >= a.budgetMin;
          const bar = over ? 'bg-emerald-500' : pct > 80 ? 'bg-amber-400' : 'bg-primary';
          return (
            <div key={a.label} className="rounded-2xl bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl ${a.color}`} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-content">{a.label}</p>
                  <p className="text-xs text-content-tertiary">
                    {fmt(a.usedMin)} of {fmt(a.budgetMin)} limit
                  </p>
                </div>
                {over ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                    Reached
                  </span>
                ) : (
                  <Icon
                    icon="ic:round-chevron-right"
                    width={20}
                    className="text-content-tertiary"
                  />
                )}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary-bg">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* The tie to habits (Yair's ask): usage is a doorway into the rest of the app. */}
      <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <Icon icon="ph:swap-bold" width={22} className="shrink-0 text-primary" />
        <p className="flex-1 text-sm text-content">
          Swap the scroll for a habit. Your evening walk is due.
        </p>
        <Icon icon="ic:round-chevron-right" width={20} className="text-primary" />
      </div>
    </div>
  );
}

function BlockedView() {
  // The blocked moment (teardown 03): the wall becomes a conversation. Calm and
  // GREEN, never red. It quotes the user's OWN reason back (stored at setup), and
  // the override is honest and non-shaming: five intentional minutes, logged, never
  // a red failure. "Talk to me" opens the coach, the one thing a voice app can do
  // that a static wall cannot.
  const [talking, setTalking] = useState(false);
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl bg-emerald-50 px-6 py-10 text-center">
      {/* The orb stands in for the coach: tappable, alive, not a stop sign. */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full shadow-lg"
        style={{ background: 'radial-gradient(circle at 35% 30%, #34d399, #059669)' }}
      >
        <Icon icon="ph:pause-bold" width={32} className="text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-emerald-900">This is your pause point</h2>
        <p className="mt-2 text-base leading-relaxed text-emerald-700">
          You told me late-night feeds are usually to wind down, not to get pulled back in.
        </p>
      </div>

      {talking && (
        <div className="flex w-full items-start gap-3 rounded-2xl bg-white/70 p-4 text-left">
          <Icon icon="ph:sparkle-bold" width={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-sm leading-relaxed text-emerald-900">
            What are you hoping this gives you right now? If it is winding down, I can put on a
            2-minute reset instead. If not, we can take five honest minutes.
          </p>
        </div>
      )}

      <div className="flex w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setTalking(true)}
          className="w-full rounded-full bg-emerald-600 py-3.5 text-base font-bold text-white"
        >
          Talk to me
        </button>
        <button
          type="button"
          className="w-full rounded-full border border-emerald-200 bg-white/60 py-3.5 text-base font-bold text-emerald-800"
        >
          Take 5 intentional minutes
        </button>
        <button type="button" className="w-full py-2 text-sm font-semibold text-emerald-700">
          Back to my day
        </button>
      </div>
      <p className="text-xs text-emerald-600">
        Whatever you choose is logged honestly. No streak breaks here.
      </p>
    </div>
  );
}

export function ScreenTimePreview() {
  const [view, setView] = useState<STView>('usage');

  // The block flows and coaching moments open full-screen from Set up, with a
  // back to Set up.
  if (view === 'schedule') return <BlockSchedulePreview onBack={() => setView('setup')} />;
  if (view === 'blocknow') return <BlockNowPreview onBack={() => setView('setup')} />;
  if (view === 'reasons') return <SetupReasonsPreview onBack={() => setView('setup')} />;
  if (view === 'reflection') return <ReflectionCheckInPreview onBack={() => setView('setup')} />;
  if (view === 'recovery') return <RecoveryCalibrationPreview onBack={() => setView('setup')} />;

  return (
    <div className="min-h-dvh bg-primary-bg px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-semibold text-content">Screen Time</h1>
      <p className="mt-1 text-sm text-content-secondary">
        Your time, your call. A calm hand on the apps you choose.
      </p>

      <div className="mt-5">
        <Switcher view={view} setView={setView} />
      </div>

      <div className="mt-6">
        {view === 'setup' && <SetupView onOpen={setView} />}
        {view === 'usage' && <UsageView />}
        {view === 'blocked' && <BlockedView />}
      </div>
    </div>
  );
}

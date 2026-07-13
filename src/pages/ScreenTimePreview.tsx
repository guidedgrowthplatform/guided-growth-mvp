import { Icon } from '@iconify/react';
import { useState } from 'react';

// Standalone, auth-free design mock of the Screen Time feature (opt-in digital
// wellbeing / self-regulation, NEVER "parental controls"). Three key states via
// a top switcher: Set up (Apple picker opt-in), Usage (on-device per-app time +
// daily budgets), Blocked (the calm green shield, never red, always states the
// reason, offers a reset instead). Route /__screentime. Mock only.

type STView = 'setup' | 'usage' | 'blocked';

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

function SetupView() {
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
    </div>
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
  // The shield: calm and GREEN, never red or punitive; always states the reason;
  // offers a way forward (a reset) instead of a dead block (spec constraint 4).
  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl bg-emerald-50 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <Icon icon="ph:seal-check-bold" width={34} className="text-emerald-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-emerald-900">That is your 30 minutes on Socials</h2>
        <p className="mt-2 text-base text-emerald-700">Back tomorrow. Nice work stepping away.</p>
      </div>
      <div className="flex w-full flex-col gap-2.5">
        <button
          type="button"
          className="w-full rounded-full bg-emerald-600 py-3.5 text-base font-bold text-white"
        >
          Take a 2-minute reset instead
        </button>
        <button type="button" className="w-full py-2 text-sm font-semibold text-emerald-700">
          Open Guided Growth
        </button>
      </div>
    </div>
  );
}

export function ScreenTimePreview() {
  const [view, setView] = useState<STView>('usage');

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
        {view === 'setup' && <SetupView />}
        {view === 'usage' && <UsageView />}
        {view === 'blocked' && <BlockedView />}
      </div>
    </div>
  );
}

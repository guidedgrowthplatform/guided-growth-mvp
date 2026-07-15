import { Icon } from '@iconify/react';
import { useState } from 'react';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingSectionHeader } from '@/components/settings/SettingSectionHeader';
import { Toggle } from '@/components/ui/Toggle';

// Standalone, auth-free design mock of the Google Calendar integration across
// ALL FIVE states Mint asked for (disconnected / connecting / connected /
// needs-reconnect / permission-denied), built on the real SettingsCard so it
// matches the existing settings surface. Extends Mint's presentational
// CalendarIntegrationSection with the 3 missing states + an explicit coach-read
// consent toggle. Route: /__calendar-states. Mock only, no real OAuth.

type CalState = 'disconnected' | 'connecting' | 'connected' | 'needs-reconnect' | 'denied';

const STATE_LABELS: Record<CalState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  'needs-reconnect': 'Needs reconnect (token expired, ~7 day beta)',
  denied: 'Permission denied',
};

function Header({ subtitle, control }: { subtitle: string; control: React.ReactNode }) {
  return (
    <div className="flex w-full items-center justify-between px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/5 p-2">
          <Icon icon="logos:google-calendar" width={24} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold text-content">Google Calendar</span>
          <span className="text-sm text-content-secondary">{subtitle}</span>
        </div>
      </div>
      {control}
    </div>
  );
}

function PrimaryButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
    >
      {label}
    </button>
  );
}

function TargetOption({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
        active ? 'border-primary bg-primary/5' : 'border-border-light bg-surface'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? 'border-primary' : 'border-border-light'
        }`}
      >
        {active && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-content">{title}</span>
        <span className="text-xs text-content-secondary">{subtitle}</span>
      </div>
    </button>
  );
}

// The connected panel: target choice (defaults to the separate GG calendar) plus
// an EXPLICIT, default-off coach-read consent toggle -- reading the user's events
// is a separate, more sensitive permission than writing our rituals to it.
function ConnectedPanel() {
  const [target, setTarget] = useState<'gg' | 'own'>('gg');
  const [coachRead, setCoachRead] = useState(false);

  return (
    <div className="border-t border-border-light px-4 py-4">
      <p className="mb-3 text-sm font-medium text-content-secondary">Where should we add events?</p>
      <div className="flex flex-col gap-2">
        <TargetOption
          active={target === 'gg'}
          onClick={() => setTarget('gg')}
          title="A “Guided Growth” calendar"
          subtitle="A separate calendar we create, so your other events stay private"
        />
        <TargetOption
          active={target === 'own'}
          onClick={() => setTarget('own')}
          title="My main calendar"
          subtitle="Events appear alongside everything else"
        />
      </div>

      <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-border-light bg-surface p-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-content">Let your coach see events</span>
          <span className="text-xs text-content-secondary">
            Reads your upcoming events for timely support. Off by default, change it anytime.
          </span>
        </div>
        <Toggle checked={coachRead} onChange={setCoachRead} ariaLabel="Let your coach see events" />
      </div>

      <button type="button" className="mt-4 text-sm font-semibold text-danger">
        Disconnect
      </button>
    </div>
  );
}

function NoticeBanner({ tone, children }: { tone: 'warn' | 'error'; children: React.ReactNode }) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div className={`border-t px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}

function CalendarCard({ state }: { state: CalState }) {
  switch (state) {
    case 'disconnected':
      return (
        <SettingsCard>
          <Header
            subtitle="Add your check-ins & reflections to your calendar"
            control={<PrimaryButton label="Connect" />}
          />
        </SettingsCard>
      );

    case 'connecting':
      return (
        <SettingsCard>
          <Header
            subtitle="Connecting to Google…"
            control={
              <span className="flex h-9 w-9 items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
              </span>
            }
          />
        </SettingsCard>
      );

    case 'connected':
      return (
        <SettingsCard>
          <Header
            subtitle="Your rituals are on your calendar"
            control={
              <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                <Icon icon="mdi:check-circle" width={18} />
                On
              </span>
            }
          />
          <ConnectedPanel />
        </SettingsCard>
      );

    case 'needs-reconnect':
      return (
        <SettingsCard>
          <Header
            subtitle="Reconnect to keep syncing"
            control={<PrimaryButton label="Reconnect" />}
          />
          <NoticeBanner tone="warn">
            Google needs you to reconnect. Your events are safe, this just refreshes access.
          </NoticeBanner>
        </SettingsCard>
      );

    case 'denied':
      return (
        <SettingsCard>
          <Header
            subtitle="Calendar access was blocked"
            control={<PrimaryButton label="Try again" />}
          />
          <NoticeBanner tone="error">
            Guided Growth didn&apos;t get calendar permission. Allow calendar access when Google
            asks, or turn it on in your Google account settings.
          </NoticeBanner>
        </SettingsCard>
      );
  }
}

export function CalendarStatesPreview() {
  const order: CalState[] = [
    'disconnected',
    'connecting',
    'connected',
    'needs-reconnect',
    'denied',
  ];

  return (
    <div className="min-h-dvh bg-primary-bg px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[22px] font-semibold text-content">Calendar integration</h1>
      <p className="mt-1 text-sm text-content-secondary">
        All five states, built on the real settings card. Mock only.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {order.map((state) => (
          <div key={state}>
            <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-primary">
              {STATE_LABELS[state]}
            </span>
            <div className="mt-1.5">
              <SettingSectionHeader title="Integrations" />
              <CalendarCard state={state} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Icon } from '@iconify/react';
import { useEffect, useRef } from 'react';
import { useCalendar } from '@/hooks/useCalendar';
import { SettingsCard } from './SettingsCard';
import { SettingSectionHeader } from './SettingSectionHeader';

// Scopes = calendar.app.created + calendar.events: user picks where events go, coach reads for context.
export function CalendarIntegrationSection() {
  const { connected, target, connect, disconnect, setTarget } = useCalendar();

  // Keep the collapsed panel's buttons out of keyboard/AT focus while disconnected.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !connected;
  }, [connected]);

  return (
    <section className="mt-8">
      <SettingSectionHeader title="Integrations" />
      <SettingsCard>
        <div className="flex w-full items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/5 p-2">
              <Icon icon="logos:google-calendar" width={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-content">Google Calendar</span>
              <span className="text-sm text-content-secondary">
                {connected
                  ? 'Your rituals are on your calendar'
                  : 'Add your check-ins & reflections to your calendar'}
              </span>
            </div>
          </div>
          {connected ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-primary">
              <Icon icon="mdi:check-circle" width={18} />
              On
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void connect()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-300 ease-in-out active:bg-primary-dark"
            >
              Connect
            </button>
          )}
        </div>

        <div
          ref={panelRef}
          className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
            connected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="min-h-0">
            <div className="border-t border-border-light px-4 py-4">
              <p className="mb-3 text-sm font-medium text-content-secondary">
                Where should we add events?
              </p>
              <div className="flex flex-col gap-2">
                <TargetOption
                  active={target === 'gg'}
                  onClick={() => setTarget('gg')}
                  title="A “Guided Growth” calendar"
                  subtitle="A separate calendar we create — your other events stay private"
                />
                <TargetOption
                  active={target === 'own'}
                  onClick={() => setTarget('own')}
                  title="My main calendar"
                  subtitle="Events appear alongside everything else"
                />
              </div>
              <p className="mt-3 text-xs text-content-tertiary">
                Your coach can also see your upcoming events to offer timely support.
              </p>
              <button
                type="button"
                onClick={() => disconnect()}
                className="mt-4 text-sm font-semibold text-danger"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </SettingsCard>
    </section>
  );
}

interface TargetOptionProps {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}

function TargetOption({ active, onClick, title, subtitle }: TargetOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all duration-300 ease-in-out ${
        active ? 'border-primary bg-primary/5' : 'border-border-light bg-surface'
      }`}
    >
      <div
        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
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

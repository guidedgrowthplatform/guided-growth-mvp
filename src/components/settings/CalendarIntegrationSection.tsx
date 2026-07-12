import { Icon } from '@iconify/react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { useCalendar } from '@/hooks/useCalendar';
import { SettingsCard } from './SettingsCard';
import { SettingSectionHeader } from './SettingSectionHeader';

export function CalendarIntegrationSection() {
  const {
    connected,
    target,
    enabled,
    needsReauth,
    isSyncing,
    connect,
    disconnect,
    setTarget,
    setEnabled,
    syncNow,
  } = useCalendar();

  const stale = connected && needsReauth;
  const paused = connected && !needsReauth && !enabled;

  // Keep the collapsed panel's controls out of keyboard/AT focus while disconnected.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !connected;
  }, [connected]);

  const subtitle = !connected
    ? 'Add your check-ins & reflections to your calendar'
    : stale
      ? 'Reconnect to keep your calendar in sync'
      : paused
        ? 'Paused — your events are kept, syncing is off'
        : 'Your rituals are on your calendar';

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
              <span className="text-sm text-content-secondary">{subtitle}</span>
            </div>
          </div>
          {!connected ? (
            <button
              type="button"
              onClick={() => void connect()}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-300 ease-in-out active:bg-primary-dark"
            >
              Connect
            </button>
          ) : stale ? (
            <button
              type="button"
              onClick={() => void connect()}
              className="flex items-center gap-1 rounded-full bg-warning/10 px-3 py-2 text-sm font-semibold text-warning transition-all duration-300 ease-in-out"
            >
              <Icon icon="mdi:alert-circle" width={18} />
              Reconnect
            </button>
          ) : paused ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-content-secondary">
              <Icon icon="mdi:pause-circle" width={18} />
              Paused
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-semibold text-primary">
              <Icon icon="mdi:check-circle" width={18} />
              On
            </span>
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
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-content">Sync to calendar</span>
                  <span className="text-xs text-content-secondary">
                    {enabled
                      ? 'New rituals are added automatically'
                      : 'Paused — existing events are kept'}
                  </span>
                </div>
                <Toggle
                  checked={enabled}
                  onChange={setEnabled}
                  ariaLabel="Sync rituals to calendar"
                  disabled={needsReauth}
                />
              </div>

              <p className="mb-3 mt-4 text-sm font-medium text-content-secondary">
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

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isSyncing}
                  onClick={() => void syncNow()}
                >
                  Sync now
                </Button>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="text-sm font-semibold text-danger"
                >
                  Disconnect
                </button>
              </div>
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

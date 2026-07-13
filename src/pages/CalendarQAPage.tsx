import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  clearCalendarReturnTo,
  consumeCalendarResult,
  markCalendarReturnTo,
  syncCalendar,
} from '@/api/calendar';
import { CalendarIntegrationSection } from '@/components/settings/CalendarIntegrationSection';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { useCalendar } from '@/hooks/useCalendar';
import { queryKeys } from '@/lib/query';

// QA/demo-only (route gated by QA_SCREEN_ENABLED): reach calendar connect
// directly, bypassing the onboarding gate that bounces /settings.
export function CalendarQAPage() {
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const { connected, target, enabled, needsReauth, isLoading, statusUnknown, refetchStatus } =
    useCalendar();
  const { addToast } = useToast();
  const qc = useQueryClient();

  // OAuth returns started from this page come back here, not /settings.
  useEffect(() => {
    markCalendarReturnTo('/qa/calendar');
    return () => clearCalendarReturnTo();
  }, []);

  // One-shot connect result (boot capture in main.tsx stashes it).
  useEffect(() => {
    const result = consumeCalendarResult();
    if (!result) return;
    if (result === 'connected') {
      addToast('success', 'Calendar connected');
      void qc.invalidateQueries({ queryKey: queryKeys.calendar.all });
      void syncCalendar().catch(() => {});
    } else {
      addToast('error', "Couldn't connect Google Calendar. Please try again.");
    }
  }, [addToast, qc]);

  return (
    <div className="min-h-screen bg-page px-4 pb-8 pt-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex flex-col">
          <h1 className="text-lg font-bold text-content">Calendar Sync</h1>
          <span className="text-xs text-content-secondary">QA / demo — no onboarding gate</span>
        </header>

        {authLoading ? (
          <div className="flex justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-content">
            <p className="font-semibold">Not signed in</p>
            <p className="mt-1 text-content-secondary">
              Calendar APIs need a session. Sign in via the QA control screen, then come back.
            </p>
            <Link
              to="/onboarding/qa"
              className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Open QA control
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-content">Live status</span>
                <button
                  type="button"
                  onClick={() => void refetchStatus()}
                  className="flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  <Icon icon="mdi:refresh" width={16} />
                  Refresh
                </button>
              </div>
              {statusUnknown ? (
                <p className="mt-2 text-sm font-medium text-danger">
                  Status check failed — showing defaults, not the real state.
                </p>
              ) : (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <StatusRow label="connected" ok={connected} loading={isLoading} />
                  <StatusRow label="enabled" ok={enabled} loading={isLoading} />
                  <div className="flex justify-between">
                    <dt className="text-content-secondary">target</dt>
                    <dd className="font-mono font-semibold text-content">{target}</dd>
                  </div>
                  <StatusRow label="needsReauth" ok={needsReauth} loading={isLoading} invert />
                </dl>
              )}
              <p className="mt-2 text-xs text-content-tertiary">Signed in as {user.email}</p>
            </div>

            <CalendarIntegrationSection />
          </>
        )}
      </div>
    </div>
  );
}

interface StatusRowProps {
  label: string;
  ok: boolean;
  loading: boolean;
  // true is the "bad" value for this field (needsReauth)
  invert?: boolean;
}

function StatusRow({ label, ok, loading, invert }: StatusRowProps) {
  const good = invert ? !ok : ok;
  return (
    <div className="flex justify-between">
      <dt className="text-content-secondary">{label}</dt>
      <dd
        className={`font-mono font-semibold ${
          loading ? 'text-content-tertiary' : good ? 'text-primary' : 'text-content-secondary'
        }`}
      >
        {loading ? '…' : String(ok)}
      </dd>
    </div>
  );
}

import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppDetailView } from '@/components/screentime/AppDetailView';
import { ChooseAppsView, type ChosenApp } from '@/components/screentime/ChooseAppsView';
import { DashboardView } from '@/components/screentime/DashboardView';
import { SAMPLE_APPS, type SampleApp, type UsageRange } from '@/components/screentime/sampleData';
import { ScreenTimeHeader } from '@/components/screentime/ScreenTimeHeader';
import { ScreenTimeIntro } from '@/components/screentime/ScreenTimeIntro';
import { ShieldPreview, type ShieldReason } from '@/components/screentime/ShieldPreview';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { useToast } from '@/contexts/ToastContext';
import {
  applyShield,
  clearShield,
  disableScreenTime,
  getScreenTimeStatus,
  isScreenTimeAvailable,
  presentAppPicker,
  presentBudgetEditor,
  requestScreenTimeAuthorization,
  showUsageReport,
  type ScreenTimeStatus,
} from '@/lib/services/screenTime';

type View = 'intro' | 'choose' | 'dashboard' | 'detail' | 'shield';

const DEFAULT_SELECTION: ChosenApp[] = SAMPLE_APPS.today
  .slice(0, 2)
  .map(({ id, name, icon }) => ({ id, name, icon }));

function ExplainerCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-2xl bg-surface p-6 text-center shadow-sm">
      <div className="mb-4 flex justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Icon icon="mdi:timer-sand" width={32} className="text-primary" />
        </div>
      </div>
      <h2 className="text-lg font-bold text-content">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">{body}</p>
    </div>
  );
}

export function ScreenTimePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isIos = isScreenTimeAvailable();

  const [status, setStatus] = useState<ScreenTimeStatus | null>(null);
  const [view, setView] = useState<View>('intro');
  const [range, setRange] = useState<UsageRange>('today');
  const [selected, setSelected] = useState<ChosenApp[]>(DEFAULT_SELECTION);
  const [detailApp, setDetailApp] = useState<SampleApp | null>(null);
  const [shieldReason, setShieldReason] = useState<ShieldReason>('limit');
  const [onBreak, setOnBreak] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmTurnOff, setConfirmTurnOff] = useState(false);
  const seeded = useRef(false);

  const refresh = useCallback(async () => {
    if (!isIos) return null;
    const next = await getScreenTimeStatus();
    setStatus(next);
    return next;
  }, [isIos]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Seed the starting view from real authorization state (iOS only, once).
  useEffect(() => {
    if (!isIos || !status || seeded.current) return;
    seeded.current = true;
    if (status.status !== 'approved') setView('intro');
    else if (!status.hasSelection) setView('choose');
    else setView('dashboard');
    setOnBreak(status.shieldActive);
  }, [isIos, status]);

  const runBusy = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleGetStarted = useCallback(
    () =>
      runBusy(async () => {
        if (!isIos) {
          setView('choose');
          return;
        }
        const auth = await requestScreenTimeAuthorization();
        if (!auth.ok) return addToast('error', auth.error);
        if (auth.value.status !== 'approved') {
          return addToast('info', 'No problem — you can turn this on anytime from Settings.');
        }
        const picked = await presentAppPicker();
        if (!picked.ok) return addToast('error', picked.error);
        const next = await refresh();
        setView(next?.hasSelection ? 'dashboard' : 'choose');
      }),
    [runBusy, isIos, addToast, refresh],
  );

  const handleChooseApps = useCallback(
    () =>
      runBusy(async () => {
        if (!isIos) {
          setSelected(DEFAULT_SELECTION);
          setView('dashboard');
          return;
        }
        const result = await presentAppPicker();
        if (!result.ok) return addToast('error', result.error);
        if (!result.value.cancelled) addToast('success', 'Your app selection is updated.');
        const next = await refresh();
        if (next?.hasSelection) setView('dashboard');
      }),
    [runBusy, isIos, addToast, refresh],
  );

  const handleTakeBreak = useCallback(
    (minutes: number | null) =>
      runBusy(async () => {
        if (isIos) {
          const result = await applyShield(minutes ?? undefined);
          if (!result.ok) return addToast('error', result.error);
          await refresh();
        }
        setOnBreak(true);
        addToast(
          'success',
          minutes
            ? `Break started — your chosen apps rest for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}.`
            : 'Break started. Your chosen apps are paused for the rest of today.',
        );
      }),
    [runBusy, isIos, addToast, refresh],
  );

  const handleEditLimits = useCallback(
    () =>
      runBusy(async () => {
        const result = await presentBudgetEditor();
        if (!result.ok) return addToast('error', result.error);
        await refresh();
      }),
    [runBusy, addToast, refresh],
  );

  const handleEndBreak = useCallback(
    () =>
      runBusy(async () => {
        if (isIos) {
          const result = await clearShield();
          if (!result.ok) return addToast('error', result.error);
        }
        setOnBreak(false);
        addToast('success', 'Break ended. Your apps are available again.');
      }),
    [runBusy, isIos, addToast],
  );

  const handleTurnOff = useCallback(() => {
    setConfirmTurnOff(false);
    void runBusy(async () => {
      if (isIos) {
        const result = await disableScreenTime();
        if (!result.ok) return addToast('error', result.error);
      }
      setOnBreak(false);
      seeded.current = false;
      setView('intro');
      addToast('success', 'Screen Time is off. You can set it up again anytime.');
    });
  }, [runBusy, isIos, addToast]);

  const handleAppTap = useCallback((app: SampleApp) => {
    setDetailApp(app);
    setView('detail');
  }, []);

  const handleRemoveApp = useCallback((id: string) => {
    setSelected((prev) => prev.filter((a) => a.id !== id));
    setView('dashboard');
  }, []);

  const handleShowNativeReport = useCallback(
    () =>
      runBusy(async () => {
        const result = await showUsageReport();
        if (!result.ok) addToast('error', result.error);
      }),
    [runBusy, addToast],
  );

  // live break countdown (real end time from native; ticks every 30s)
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!onBreak) return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [onBreak]);
  const breakRemaining = useMemo(() => {
    const ends = status?.breakEndsAt ?? 0;
    if (!ends) return undefined;
    const mins = Math.max(0, Math.round((ends * 1000 - nowTick) / 60_000));
    if (mins > 12 * 60) return 'resting for the rest of today';
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m to go`;
    return `${mins}m to go`;
  }, [status, nowTick]);

  // --- render ---

  if (isIos && status === null) {
    return (
      <div>
        <ScreenTimeHeader title="Screen Time" onBack={() => navigate(-1)} />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      </div>
    );
  }

  if (isIos && status && !status.supported) {
    return (
      <div>
        <ScreenTimeHeader title="Screen Time" onBack={() => navigate(-1)} />
        <ExplainerCard
          title="Almost there"
          body="Screen Time uses tools from a newer version of iOS. Update your iPhone in Settings to start using it."
        />
      </div>
    );
  }

  if (view === 'shield') {
    return (
      <ShieldPreview
        reason={shieldReason}
        onPrimary={() => setView('dashboard')}
        onSecondary={() => setView('dashboard')}
      />
    );
  }

  const denied = isIos && status?.status === 'denied';

  return (
    <div className="flex min-h-[72vh] flex-col">
      <ScreenTimeHeader
        title={view === 'detail' && detailApp ? detailApp.name : 'Screen Time'}
        onBack={() => {
          if (view === 'detail') setView('dashboard');
          else navigate(-1);
        }}
        onMenu={view === 'dashboard' ? () => setView('choose') : undefined}
      />

      {view === 'intro' && (
        <ScreenTimeIntro busy={busy} denied={denied} onGetStarted={() => void handleGetStarted()} />
      )}

      {view === 'choose' && (
        <ChooseAppsView
          selected={selected}
          busy={busy}
          onChooseApps={() => void handleChooseApps()}
          onRemove={handleRemoveApp}
        />
      )}

      {view === 'dashboard' && (
        <DashboardView
          range={range}
          onRangeChange={setRange}
          onBreak={onBreak}
          busy={busy}
          onAppTap={handleAppTap}
          onTakeBreak={(minutes) => void handleTakeBreak(minutes)}
          breakRemaining={breakRemaining}
          onEndBreak={() => void handleEndBreak()}
          onTurnOff={() => setConfirmTurnOff(true)}
          onShowNativeReport={isIos ? () => void handleShowNativeReport() : undefined}
          nativeUsage={isIos && status?.status === 'approved'}
          onEditLimits={
            isIos && status?.status === 'approved' ? () => void handleEditLimits() : undefined
          }
          budgetCount={status?.budgetCount ?? 0}
        />
      )}

      {view === 'detail' && detailApp && (
        <AppDetailView
          app={detailApp}
          onPauseNow={() => {
            setShieldReason('limit');
            setView('shield');
          }}
          onRemove={() => handleRemoveApp(detailApp.id)}
        />
      )}

      {confirmTurnOff && (
        <ConfirmDialog
          title="Turn off Screen Time?"
          message="This clears your app selection, daily limits, and any active break. You can set it up again whenever you like."
          confirmLabel="Turn off"
          cancelLabel="Keep it on"
          onConfirm={handleTurnOff}
          onCancel={() => setConfirmTurnOff(false)}
        />
      )}
    </div>
  );
}

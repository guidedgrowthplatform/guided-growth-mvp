import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AndroidAppPicker } from '@/components/screentime/AndroidAppPicker';
import { AndroidLimitsView } from '@/components/screentime/AndroidLimitsView';
import { AppDetailView } from '@/components/screentime/AppDetailView';
import { ChooseAppsView, type ChosenApp } from '@/components/screentime/ChooseAppsView';
import { DashboardView } from '@/components/screentime/DashboardView';
import { SAMPLE_APPS, type SampleApp, type UsageRange } from '@/components/screentime/sampleData';
import { ScreenTimeHeader } from '@/components/screentime/ScreenTimeHeader';
import { ScreenTimeIntro } from '@/components/screentime/ScreenTimeIntro';
import { ShieldPreview, type ShieldReason } from '@/components/screentime/ShieldPreview';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { useToast } from '@/contexts/ToastContext';
import { useSessionLog } from '@/hooks/useSessionLog';
import {
  type AndroidBudgetInput,
  type AndroidUsageRow,
  applyShield,
  clearShield,
  disableScreenTime,
  getAndroidUsage,
  getAppBudgets,
  getBoundaryStates,
  getScreenTimePlatform,
  getScreenTimeStatus,
  presentAppPicker,
  presentBudgetEditor,
  requestScreenTimeAuthorization,
  setAppBudgets,
  setAppSelection,
  showUsageReport,
  type ScreenTimeStatus,
} from '@/lib/services/screenTime';
import type { ScreenTimeBoundary } from '@gg/shared/types/screentime';

type View = 'intro' | 'choose' | 'dashboard' | 'detail' | 'shield' | 'limits';

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// boundary_set / boundary_removed from a before/after diff (both platforms)
function diffBoundaries(
  before: ScreenTimeBoundary[],
  after: ScreenTimeBoundary[],
  logEvent: (event: string, payload?: Record<string, unknown>) => void,
) {
  const beforeById = new Map(before.map((b) => [b.id, b]));
  for (const b of after) {
    const prev = beforeById.get(b.id);
    if (!prev || prev.limitMinutes !== b.limitMinutes) {
      logEvent('screentime_boundary_set', {
        boundary_id: b.id,
        kind: b.kind,
        limit_minutes: b.limitMinutes,
        window: b.window,
      });
    }
  }
  const afterIds = new Set(after.map((b) => b.id));
  for (const b of before) {
    if (!afterIds.has(b.id)) logEvent('screentime_boundary_removed', { boundary_id: b.id });
  }
}

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
  const { logEvent } = useSessionLog();
  const platform = getScreenTimePlatform();
  const isIos = platform === 'ios';
  const isAndroid = platform === 'android';
  const isNative = platform !== 'web';

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
    if (!isNative) return null;
    const next = await getScreenTimeStatus();
    setStatus(next);
    return next;
  }, [isNative]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Seed the starting view from real authorization state (native only, once).
  useEffect(() => {
    if (!isNative || !status || seeded.current) return;
    seeded.current = true;
    if (status.status !== 'approved') setView('intro');
    else if (!status.hasSelection) setView('choose');
    else setView('dashboard');
    setOnBreak(status.shieldActive);
  }, [isNative, status]);

  // Android grants Usage Access in system Settings — re-check on return.
  useEffect(() => {
    if (!isAndroid) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App: CapApp }) => {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refresh();
      }).then((handle) => {
        remove = () => void handle.remove();
      });
    });
    return () => remove?.();
  }, [isAndroid, refresh]);

  // Android: the grant just landed while the intro is showing → move forward.
  useEffect(() => {
    if (!isAndroid || !seeded.current || view !== 'intro') return;
    if (status?.status === 'approved') setView(status.hasSelection ? 'dashboard' : 'choose');
  }, [isAndroid, status, view]);

  // Android real usage rows (on-device only)
  const [androidUsage, setAndroidUsage] = useState<AndroidUsageRow[] | null>(null);
  const [androidBudgets, setAndroidBudgets] = useState<Required<AndroidBudgetInput>[]>([]);

  useEffect(() => {
    if (!isAndroid || status?.status !== 'approved') return;
    void getAndroidUsage(range).then((result) => {
      if (result.ok) setAndroidUsage(result.value.apps);
    });
    void getAppBudgets().then(setAndroidBudgets);
  }, [isAndroid, status, range, view]);

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
        if (!isNative) {
          setView('choose');
          return;
        }
        const auth = await requestScreenTimeAuthorization();
        if (!auth.ok) return addToast('error', auth.error);
        if (isAndroid) {
          // deep-linked to system Settings; the resume listener picks up the grant
          if (auth.value.status !== 'approved') {
            addToast('info', 'Allow "Usage access" for Guided Growth, then come back.');
          } else {
            setView(status?.hasSelection ? 'dashboard' : 'choose');
          }
          return;
        }
        if (auth.value.status !== 'approved') {
          return addToast('info', 'No problem — you can turn this on anytime from Settings.');
        }
        const picked = await presentAppPicker();
        if (!picked.ok) return addToast('error', picked.error);
        const next = await refresh();
        setView(next?.hasSelection ? 'dashboard' : 'choose');
      }),
    [runBusy, isNative, isAndroid, status, addToast, refresh],
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
        logEvent('screentime_break_started', minutes ? { minutes } : {});
        setOnBreak(true);
        addToast(
          'success',
          minutes
            ? `Break started — your chosen apps rest for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}.`
            : 'Break started. Your chosen apps are paused for the rest of today.',
        );
      }),
    [runBusy, isIos, addToast, refresh, logEvent],
  );

  const handleEditLimits = useCallback(
    () =>
      runBusy(async () => {
        if (isAndroid) {
          setView('limits');
          return;
        }
        // diff boundaries around the native editor → boundary_set/removed events
        const before = (await getBoundaryStates()).boundaries;
        const result = await presentBudgetEditor();
        if (!result.ok) return addToast('error', result.error);
        const after = (await getBoundaryStates()).boundaries;
        diffBoundaries(before, after, logEvent);
        await refresh();
      }),
    [runBusy, isAndroid, addToast, refresh, logEvent],
  );

  const handleAndroidSavePicker = useCallback(
    (packageNames: string[]) =>
      runBusy(async () => {
        const result = await setAppSelection(packageNames);
        if (!result.ok) return addToast('error', result.error);
        addToast('success', 'Your app selection is updated.');
        await refresh();
        setView('dashboard');
      }),
    [runBusy, addToast, refresh],
  );

  const handleAndroidSaveLimits = useCallback(
    (budgets: AndroidBudgetInput[]) =>
      runBusy(async () => {
        const before = (await getBoundaryStates()).boundaries;
        const result = await setAppBudgets(budgets);
        if (!result.ok) return addToast('error', result.error);
        const after = (await getBoundaryStates()).boundaries;
        diffBoundaries(before, after, logEvent);
        addToast('success', 'Your daily limits are saved.');
        await refresh();
        setView('dashboard');
      }),
    [runBusy, addToast, refresh, logEvent],
  );

  const handleEndBreak = useCallback(
    () =>
      runBusy(async () => {
        if (isIos) {
          const result = await clearShield();
          if (!result.ok) return addToast('error', result.error);
        }
        logEvent('screentime_break_ended', { reason: 'ended_manually' });
        setOnBreak(false);
        addToast('success', 'Break ended. Your apps are available again.');
      }),
    [runBusy, isIos, addToast, logEvent],
  );

  const handleTurnOff = useCallback(() => {
    setConfirmTurnOff(false);
    void runBusy(async () => {
      if (isNative) {
        const result = await disableScreenTime();
        if (!result.ok) return addToast('error', result.error);
      }
      setOnBreak(false);
      seeded.current = false;
      setView('intro');
      addToast('success', 'Screen Time is off. You can set it up again anytime.');
    });
  }, [runBusy, isNative, addToast]);

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

  // Android rows → the dashboard's display shape (labels/icons on-device only)
  const androidApps = useMemo<SampleApp[] | undefined>(() => {
    if (!isAndroid || !androidUsage) return undefined;
    const limits = new Map(androidBudgets.map((b) => [b.packageName, b.minutes]));
    const heaviest = Math.max(1, ...androidUsage.map((a) => a.minutes));
    return [...androidUsage]
      .sort((a, b) => b.minutes - a.minutes)
      .map((app) => {
        const limit = limits.get(app.packageName) ?? null;
        const fill = Math.min(100, Math.round((app.minutes / (limit ?? heaviest)) * 100));
        return {
          id: app.packageName,
          name: app.label,
          icon: 'mdi:cellphone',
          time: formatMinutes(app.minutes),
          fill,
          sub: limit ? `of your ${formatMinutes(limit)} limit` : 'no limit set',
          resting: false,
          heavy: fill >= 67,
          todayTime: formatMinutes(app.minutes),
          dailyAverage: '—',
          limitOn: limit !== null,
          limitMinutes: limit,
        };
      });
  }, [isAndroid, androidUsage, androidBudgets]);

  const androidSummary = useMemo(() => {
    if (!isAndroid || !androidUsage) return undefined;
    const total = androidUsage.reduce((sum, a) => sum + a.minutes, 0);
    return {
      total: formatMinutes(total),
      caption:
        range === 'today' ? 'across your chosen apps today' : 'across your chosen apps this week',
    };
  }, [isAndroid, androidUsage, range]);

  // --- render ---

  if (isNative && status === null) {
    return (
      <div>
        <ScreenTimeHeader title="Screen Time" onBack={() => navigate(-1)} />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      </div>
    );
  }

  if (isNative && status && !status.supported) {
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

      {view === 'choose' &&
        (isAndroid ? (
          <AndroidAppPicker
            initialSelection={(androidUsage ?? []).map((a) => a.packageName)}
            busy={busy}
            onSave={(packageNames) => void handleAndroidSavePicker(packageNames)}
            onCancel={() => setView(status?.hasSelection ? 'dashboard' : 'intro')}
          />
        ) : (
          <ChooseAppsView
            selected={selected}
            busy={busy}
            onChooseApps={() => void handleChooseApps()}
            onRemove={handleRemoveApp}
          />
        ))}

      {view === 'limits' && isAndroid && (
        <AndroidLimitsView
          apps={androidUsage ?? []}
          currentLimits={new Map(androidBudgets.map((b) => [b.packageName, b.minutes]))}
          busy={busy}
          onSave={(budgets) => void handleAndroidSaveLimits(budgets)}
          onCancel={() => setView('dashboard')}
        />
      )}

      {view === 'dashboard' && (
        <DashboardView
          range={range}
          onRangeChange={setRange}
          onBreak={onBreak}
          busy={busy}
          onAppTap={isAndroid ? () => setView('limits') : handleAppTap}
          onTakeBreak={(minutes) => void handleTakeBreak(minutes)}
          breakRemaining={breakRemaining}
          onEndBreak={() => void handleEndBreak()}
          onTurnOff={() => setConfirmTurnOff(true)}
          onShowNativeReport={isIos ? () => void handleShowNativeReport() : undefined}
          nativeUsage={isIos && status?.status === 'approved'}
          onEditLimits={
            isNative && status?.status === 'approved' ? () => void handleEditLimits() : undefined
          }
          budgetCount={status?.budgetCount ?? 0}
          appsOverride={androidApps}
          summaryOverride={androidSummary}
          canBreak={!isAndroid}
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

import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/settings/ConfirmDialog';
import { SettingRow } from '@/components/settings/SettingRow';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingSectionHeader } from '@/components/settings/SettingSectionHeader';
import { Button } from '@/components/ui/Button';
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

type ConfirmKind = 'startBreak' | 'endBreak' | 'turnOff';

function PageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
      >
        <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
      </button>
      <h1 className="text-xl font-bold text-content">Screen Time</h1>
      <div className="h-10 w-10" />
    </div>
  );
}

function ExplainerCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-2xl bg-surface p-6 text-center shadow-sm">
      <div className="mb-4 flex justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Icon icon="mdi:cellphone-lock" width={32} className="text-primary" />
        </div>
      </div>
      <h2 className="text-lg font-bold text-content">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-content-secondary">{body}</p>
    </div>
  );
}

function IntroBullet({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-primary/5 p-2">
        <Icon icon={icon} width={20} className="text-primary" />
      </div>
      <p className="pt-1.5 text-sm leading-relaxed text-content-secondary">{text}</p>
    </div>
  );
}

export function ScreenTimePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isIos = isScreenTimeAvailable();

  const [status, setStatus] = useState<ScreenTimeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getScreenTimeStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  const handleGetStarted = useCallback(
    () =>
      runAction(async () => {
        const auth = await requestScreenTimeAuthorization();
        if (!auth.ok) {
          addToast('error', auth.error);
          return;
        }
        if (auth.value.status !== 'approved') {
          addToast('info', 'No problem — you can turn this on anytime from Settings.');
          return;
        }
        const picked = await presentAppPicker();
        if (!picked.ok) addToast('error', picked.error);
      }),
    [runAction, addToast],
  );

  const handleChooseApps = useCallback(
    () =>
      runAction(async () => {
        const result = await presentAppPicker();
        if (!result.ok) {
          addToast('error', result.error);
        } else if (!result.value.cancelled) {
          addToast('success', 'Your app selection is updated.');
        }
      }),
    [runAction, addToast],
  );

  const handleShowUsage = useCallback(
    () =>
      runAction(async () => {
        const result = await showUsageReport();
        if (!result.ok) addToast('error', result.error);
      }),
    [runAction, addToast],
  );

  const handleEditBudgets = useCallback(
    () =>
      runAction(async () => {
        const result = await presentBudgetEditor();
        if (!result.ok) addToast('error', result.error);
      }),
    [runAction, addToast],
  );

  const handleStartBreak = useCallback(() => {
    setConfirm(null);
    void runAction(async () => {
      const result = await applyShield();
      if (result.ok) {
        addToast('success', 'Break started. Your chosen apps are paused for now.');
      } else {
        addToast('error', result.error);
      }
    });
  }, [runAction, addToast]);

  const handleEndBreak = useCallback(() => {
    setConfirm(null);
    void runAction(async () => {
      const result = await clearShield();
      if (result.ok) {
        addToast('success', 'Break ended. Your apps are available again.');
      } else {
        addToast('error', result.error);
      }
    });
  }, [runAction, addToast]);

  const handleTurnOff = useCallback(() => {
    setConfirm(null);
    void runAction(async () => {
      const result = await disableScreenTime();
      if (result.ok) {
        addToast('success', 'Screen Time is off. You can set it up again anytime.');
      } else {
        addToast('error', result.error);
      }
    });
  }, [runAction, addToast]);

  const renderBody = () => {
    if (!isIos) {
      return (
        <ExplainerCard
          title="Available on iPhone"
          body="Screen Time helps you notice where your attention goes and set gentle daily limits on the apps you choose. It uses tools built into iOS, so it lives in the iPhone app."
        />
      );
    }

    if (!status) {
      return (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      );
    }

    if (!status.supported) {
      return (
        <ExplainerCard
          title="Almost there"
          body="Screen Time uses tools from a newer version of iOS. Update your iPhone in Settings to start using it."
        />
      );
    }

    if (status.status !== 'approved') {
      return (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl bg-surface p-6 shadow-sm">
            <div className="mb-5 flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Icon icon="mdi:cellphone-lock" width={32} className="text-primary" />
              </div>
            </div>
            <h2 className="text-center text-lg font-bold text-content">Your time, on your terms</h2>
            <div className="mt-5 space-y-4">
              <IntroBullet
                icon="mdi:apps"
                text="Pick the apps you find distracting — it's entirely your choice."
              />
              <IntroBullet
                icon="mdi:chart-donut"
                text="See how you spend your time, right on this device."
              />
              <IntroBullet
                icon="mdi:timer-sand"
                text="Set daily limits. When you reach one, the app takes a rest until tomorrow."
              />
            </div>
            <p className="mt-5 text-center text-xs leading-relaxed text-content-tertiary">
              Your app usage never leaves your phone — Guided Growth only sees counts, never app
              names.
            </p>
          </div>
          <Button size="auth" fullWidth loading={busy} onClick={() => void handleGetStarted()}>
            Get started
          </Button>
          {status.status === 'denied' && (
            <p className="text-center text-xs text-content-tertiary">
              If access was declined earlier, you can allow it anytime in your iPhone Settings.
            </p>
          )}
        </div>
      );
    }

    const selectionLabel = status.hasSelection
      ? [
          status.applicationCount > 0 &&
            `${status.applicationCount} app${status.applicationCount === 1 ? '' : 's'}`,
          status.categoryCount > 0 &&
            `${status.categoryCount} categor${status.categoryCount === 1 ? 'y' : 'ies'}`,
        ]
          .filter(Boolean)
          .join(' · ') || 'Selection made'
      : 'No apps chosen yet';
    const budgetLabel =
      status.budgetCount > 0
        ? `${status.budgetCount} daily limit${status.budgetCount === 1 ? '' : 's'} set`
        : 'No daily limits yet';

    return (
      <div className="space-y-8">
        <section className="mt-8">
          <SettingSectionHeader title="Today" />
          <div className="mt-3 rounded-2xl bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/5 p-2">
                <Icon icon="mdi:apps" width={24} className="text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold text-content">{selectionLabel}</p>
                <p className="text-sm text-content-secondary">{budgetLabel}</p>
              </div>
            </div>
            {status.shieldActive && (
              <div className="mt-4 flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2">
                <Icon icon="mdi:leaf" width={18} className="text-primary" />
                <span className="text-sm font-semibold text-primary">
                  Break in progress — your chosen apps are resting
                </span>
              </div>
            )}
          </div>
        </section>

        <section>
          <SettingSectionHeader title="Your setup" />
          <SettingsCard>
            <SettingRow
              icon="mdi:apps"
              label="Choose apps"
              isFirst
              onClick={() => void handleChooseApps()}
              right={
                <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary" />
              }
            />
            <SettingRow
              icon="mdi:chart-donut"
              label="See my usage"
              onClick={() => void handleShowUsage()}
              right={
                <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary" />
              }
            />
            <SettingRow
              icon="mdi:timer-sand"
              label="Set daily limits"
              onClick={() => void handleEditBudgets()}
              right={
                <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary" />
              }
            />
          </SettingsCard>
        </section>

        <section className="space-y-4">
          {status.shieldActive ? (
            <Button
              variant="secondary"
              size="auth"
              fullWidth
              loading={busy}
              onClick={() => setConfirm('endBreak')}
            >
              End break
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="auth"
              fullWidth
              loading={busy}
              onClick={() => setConfirm('startBreak')}
            >
              Take a break now
            </Button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm('turnOff')}
            className="w-full py-2 text-center text-sm font-semibold text-content-tertiary disabled:opacity-50"
          >
            Turn off Screen Time
          </button>
        </section>
      </div>
    );
  };

  return (
    <div>
      <PageHeader onBack={() => navigate(-1)} />
      {renderBody()}

      {confirm === 'startBreak' && (
        <ConfirmDialog
          title="Take a break now?"
          message="Your chosen apps will rest until you end the break. You can end it anytime."
          confirmLabel="Start break"
          cancelLabel="Not now"
          onConfirm={handleStartBreak}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'endBreak' && (
        <ConfirmDialog
          title="End your break?"
          message="Your chosen apps will be available again right away."
          confirmLabel="End break"
          cancelLabel="Keep resting"
          onConfirm={handleEndBreak}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'turnOff' && (
        <ConfirmDialog
          title="Turn off Screen Time?"
          message="This clears your app selection, daily limits, and any active break. You can set it up again whenever you like."
          confirmLabel="Turn off"
          cancelLabel="Keep it on"
          onConfirm={handleTurnOff}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

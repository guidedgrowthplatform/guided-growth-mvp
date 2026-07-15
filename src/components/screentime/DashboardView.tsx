import { Icon } from '@iconify/react';
import { SegmentedControl } from '@/components/insights/SegmentedControl';
import { NativeUsageCard } from './NativeUsageCard';
import { SAMPLE_APPS, SUMMARY, type SampleApp, type UsageRange } from './sampleData';
import { UsageBarChart } from './UsageBarChart';

interface DashboardViewProps {
  range: UsageRange;
  onRangeChange: (range: UsageRange) => void;
  onBreak: boolean;
  breakRemaining?: string;
  busy?: boolean;
  onAppTap: (app: SampleApp) => void;
  onTakeBreak: () => void;
  onEndBreak: () => void;
  onTurnOff: () => void;
  /** iOS only — open the native DeviceActivityReport (real usage). */
  onShowNativeReport?: () => void;
  /** iOS + authorized — embed the native report inline instead of the sample chart. */
  nativeUsage?: boolean;
}

function AppRow({ app, onTap }: { app: SampleApp; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full items-center gap-3 px-4 py-[13px] text-left"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/[0.06]">
        <Icon icon={app.icon} width={22} className="text-primary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-content">{app.name}</span>
          <span className="text-sm font-bold text-content-secondary">{app.time}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-primary/[0.08]">
          <div
            className={`h-full rounded-full ${app.heavy ? 'bg-primary' : 'bg-primary/25'}`}
            style={{ width: `${app.fill}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-content-tertiary">{app.sub}</span>
          {app.resting && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/[0.08] px-2 py-[3px] text-[11px] font-extrabold text-primary-dark">
              <Icon icon="mdi:moon-waning-crescent" width={11} />
              Resting until tomorrow
            </span>
          )}
        </div>
      </div>
      <Icon
        icon="ic:round-chevron-right"
        width={20}
        className="flex-shrink-0 text-content-tertiary/60"
      />
    </button>
  );
}

export function DashboardView({
  range,
  onRangeChange,
  onBreak,
  breakRemaining = '22 minutes to go',
  busy,
  onAppTap,
  onTakeBreak,
  onEndBreak,
  onTurnOff,
  onShowNativeReport,
  nativeUsage,
}: DashboardViewProps) {
  const summary = SUMMARY[range];
  const apps = SAMPLE_APPS[range];

  return (
    <div className="mt-4 flex flex-col gap-5">
      <SegmentedControl
        size="lg"
        value={range}
        onChange={(v) => onRangeChange(v as UsageRange)}
        items={[
          { label: 'Today', value: 'today' },
          { label: 'This week', value: 'week' },
        ]}
      />

      {nativeUsage ? (
        // real numbers, rendered on-device by the sandboxed report extension
        <NativeUsageCard range={range} height={480} />
      ) : (
        <>
          <div className="flex flex-col gap-1 text-center">
            <div className="text-[42px] font-extrabold tracking-[-1px] text-content">
              {summary.total}
            </div>
            <div className="text-sm font-bold text-primary">{summary.caption}</div>
          </div>

          <UsageBarChart bars={summary.bars} labels={summary.labels} />
        </>
      )}

      {onShowNativeReport && !nativeUsage && (
        <button
          type="button"
          onClick={onShowNativeReport}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary/[0.08] py-3 text-sm font-bold text-primary-dark"
        >
          <Icon icon="mdi:chart-box-outline" width={18} />
          See my real usage (on device)
        </button>
      )}

      {!nativeUsage && (
        <div className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-extrabold uppercase tracking-[1.2px] text-content-tertiary">
            Your apps
          </p>
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            {apps.map((app, i) => (
              <div key={app.id} className={i > 0 ? 'border-t border-border-light' : ''}>
                <AppRow app={app} onTap={() => onAppTap(app)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <p className="px-1 text-xs font-extrabold uppercase tracking-[1.2px] text-content-tertiary">
          A moment of quiet
        </p>
        {onBreak ? (
          <div className="flex items-center gap-3 rounded-2xl bg-primary/[0.08] p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface">
              <Icon icon="mdi:timer-sand" width={22} className="text-primary" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold text-primary-dark">On a break</span>
              <span className="text-[13px] font-semibold text-primary">{breakRemaining}</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onEndBreak}
              className="flex h-10 items-center rounded-full bg-surface px-[18px] text-sm font-bold text-primary-dark disabled:opacity-50"
            >
              End break
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/[0.06]">
              <Icon icon="mdi:timer-sand" width={22} className="text-primary" />
            </div>
            <p className="flex-1 text-[13.5px] leading-snug text-content-secondary">
              Pause your chosen apps for a little while.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onTakeBreak}
              className="flex h-10 items-center rounded-full bg-primary px-[18px] text-sm font-bold text-white disabled:opacity-50"
            >
              Take a break
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onTurnOff}
        className="flex flex-col items-center gap-1.5 pt-1 disabled:opacity-50"
      >
        <span className="text-sm font-bold text-content-secondary">Turn off Screen Time</span>
        <span className="text-center text-xs text-content-tertiary">
          Everything pauses immediately. Your data stays on your iPhone.
        </span>
      </button>
    </div>
  );
}

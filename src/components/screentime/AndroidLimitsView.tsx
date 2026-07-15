import { useState } from 'react';
import type { AndroidBudgetInput, AndroidUsageRow } from '@/lib/services/screenTime';

const PRESETS: { label: string; minutes: number | null }[] = [
  { label: 'None', minutes: null },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
];

interface AndroidLimitsViewProps {
  // selected apps (labels on-device only) + any current limits keyed by package
  apps: AndroidUsageRow[];
  currentLimits: Map<string, number>;
  busy?: boolean;
  onSave: (budgets: AndroidBudgetInput[]) => void;
  onCancel: () => void;
}

// Android daily-limits editor. v1 data track: limits feed the coach bands
// (kept/approaching/crossed); real blocking arrives with the Android shield
// milestone.
export function AndroidLimitsView({
  apps,
  currentLimits,
  busy,
  onSave,
  onCancel,
}: AndroidLimitsViewProps) {
  const [limits, setLimits] = useState<Map<string, number | null>>(
    () => new Map(apps.map((a) => [a.packageName, currentLimits.get(a.packageName) ?? null])),
  );

  const setLimit = (packageName: string, minutes: number | null) => {
    setLimits((prev) => new Map(prev).set(packageName, minutes));
  };

  const save = () => {
    const budgets: AndroidBudgetInput[] = [];
    for (const [packageName, minutes] of limits) {
      if (minutes !== null) budgets.push({ packageName, minutes });
    }
    onSave(budgets);
  };

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[21px] font-extrabold text-content">Daily limits</h2>
        <p className="text-sm leading-relaxed text-content-secondary">
          Set a daily time budget per app. Your coach sees how the boundary is going — never your
          minutes.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {apps.map((app) => {
          const current = limits.get(app.packageName) ?? null;
          return (
            <div
              key={app.packageName}
              className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.03)]"
            >
              <span className="text-[15px] font-bold text-content">{app.label}</span>
              <div className="flex gap-2">
                {PRESETS.map((preset) => {
                  const active = current === preset.minutes;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setLimit(app.packageName, preset.minutes)}
                      className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
                        active
                          ? 'bg-primary text-white'
                          : 'bg-surface-secondary text-content-secondary'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-surface-secondary text-base font-bold text-content-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-primary text-base font-bold text-white shadow-[0px_8px_20px_rgba(19,91,235,0.25)] disabled:opacity-50"
        >
          Save limits
        </button>
      </div>
    </div>
  );
}

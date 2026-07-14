import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { formatLimit, LIMIT_MAX, LIMIT_MIN, LIMIT_PRESETS, type SampleApp } from './sampleData';

interface AppDetailViewProps {
  app: SampleApp;
  onPauseNow: () => void;
  onRemove: () => void;
}

export function AppDetailView({ app, onPauseNow, onRemove }: AppDetailViewProps) {
  const [limitOn, setLimitOn] = useState(app.limitOn);
  const [minutes, setMinutes] = useState(app.limitMinutes ?? 120);

  const pct = ((minutes - LIMIT_MIN) / (LIMIT_MAX - LIMIT_MIN)) * 100;

  return (
    <div className="mt-5 flex flex-col gap-[18px]">
      <div className="flex flex-col items-center gap-2.5">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary/[0.06]">
          <Icon icon={app.icon} width={36} className="text-primary" />
        </div>
        <div className="text-center">
          <div className="text-[30px] font-extrabold tracking-[-0.5px] text-content">
            {app.todayTime}
          </div>
          <div className="text-[13px] font-semibold text-content-tertiary">
            today · {app.dailyAverage}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/[0.06]">
              <Icon icon="mdi:timer-outline" width={22} className="text-primary" />
            </div>
            <span className="text-[15px] font-bold text-content">Daily limit</span>
          </div>
          <Toggle checked={limitOn} onChange={setLimitOn} ariaLabel="Daily limit" />
        </div>

        {limitOn && (
          <div className="px-4 pb-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-content-secondary">Limit</span>
              <span className="text-[22px] font-extrabold text-primary">
                {formatLimit(minutes)}
              </span>
            </div>

            <input
              type="range"
              min={LIMIT_MIN}
              max={LIMIT_MAX}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="Daily limit minutes"
              className="gg-range h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(to right, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) ${pct}%, rgb(var(--color-primary) / 0.08) ${pct}%, rgb(var(--color-primary) / 0.08) 100%)`,
              }}
            />

            <div className="mt-2 flex justify-between">
              <span className="text-[11px] font-bold text-content-tertiary/70">15m</span>
              <span className="text-[11px] font-bold text-content-tertiary/70">4h</span>
            </div>

            <div className="mt-3 flex gap-2">
              {LIMIT_PRESETS.map((p) => {
                const active = minutes === p.minutes;
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => setMinutes(p.minutes)}
                    className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
                      active
                        ? 'bg-primary text-white'
                        : 'bg-surface-secondary text-content-secondary'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={onPauseNow}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/[0.06]">
            <Icon icon="mdi:pause-circle-outline" width={22} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-content">Pause {app.name} now</div>
            <div className="text-xs text-content-tertiary">Rest it for the rest of today</div>
          </div>
          <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary/60" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex w-full items-center gap-3 border-t border-border-light px-4 py-3.5 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/[0.06]">
            <Icon icon="mdi:minus-circle-outline" width={22} className="text-primary" />
          </div>
          <span className="flex-1 text-[15px] font-bold text-content">Remove from Screen Time</span>
          <Icon icon="ic:round-chevron-right" width={20} className="text-content-tertiary/60" />
        </button>
      </div>
    </div>
  );
}

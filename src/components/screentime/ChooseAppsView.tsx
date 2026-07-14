import { Icon } from '@iconify/react';

export interface ChosenApp {
  id: string;
  name: string;
  icon: string;
}

interface ChooseAppsViewProps {
  selected: ChosenApp[];
  busy?: boolean;
  onChooseApps: () => void;
  onRemove?: (id: string) => void;
}

export function ChooseAppsView({ selected, busy, onChooseApps, onRemove }: ChooseAppsViewProps) {
  return (
    <div className="mt-5 flex flex-col gap-[18px]">
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/[0.08] px-4 py-2">
          <Icon icon="mdi:check-circle" width={18} className="text-primary" />
          <span className="text-[13px] font-bold text-primary-dark">
            Connected — you&rsquo;re all set up
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[21px] font-extrabold text-content">Pick a few apps to notice</h2>
        <p className="text-sm leading-relaxed text-content-secondary">
          Start small — one or two is plenty. You&rsquo;re just choosing what to pay attention to.
        </p>
      </div>

      <div className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-border bg-surface/60 px-5 py-[22px]">
        <Icon icon="mdi:apple" width={30} className="flex-shrink-0 text-content-tertiary" />
        <p className="font-mono text-[11.5px] leading-relaxed text-content-secondary">
          Apple app picker (FamilyActivityPicker) — OS-native sheet opens here on device
        </p>
      </div>

      {selected.length > 0 && (
        <>
          <p className="px-1 pt-1 text-xs font-extrabold uppercase tracking-[1.2px] text-content-tertiary">
            Selected · {selected.length} app{selected.length === 1 ? '' : 's'}
          </p>
          <div className="overflow-hidden rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
            {selected.map((app, i) => (
              <div
                key={app.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  i > 0 ? 'border-t border-border-light' : ''
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/[0.06]">
                  <Icon icon={app.icon} width={22} className="text-primary" />
                </div>
                <span className="flex-1 text-[15px] font-bold text-content">{app.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${app.name}`}
                  onClick={() => onRemove?.(app.id)}
                  className="p-1"
                >
                  <Icon icon="ic:round-close" width={20} className="text-content-tertiary" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onChooseApps}
        className="mt-0.5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-white shadow-[0px_8px_20px_rgba(19,91,235,0.25)] transition-all disabled:opacity-50"
      >
        <Icon icon="mdi:plus" width={20} />
        Choose apps
      </button>
    </div>
  );
}

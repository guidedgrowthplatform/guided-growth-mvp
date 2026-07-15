import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { getInstalledApps, type AndroidInstalledApp } from '@/lib/services/screenTime';

interface AndroidAppPickerProps {
  initialSelection: string[];
  busy?: boolean;
  onSave: (packageNames: string[]) => void;
  onCancel: () => void;
}

function AppIcon({ app }: { app: AndroidInstalledApp }) {
  if (app.icon) {
    return <img src={app.icon} alt="" className="h-10 w-10 rounded-2xl" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/[0.06] text-[15px] font-bold text-primary">
      {app.label.slice(0, 1).toUpperCase()}
    </div>
  );
}

// Android app picker — our own list (launcher apps via the scoped <queries>
// filter). Names/icons render here on-device only; never transmitted.
export function AndroidAppPicker({
  initialSelection,
  busy,
  onSave,
  onCancel,
}: AndroidAppPickerProps) {
  const [apps, setApps] = useState<AndroidInstalledApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initialSelection));

  useEffect(() => {
    void getInstalledApps().then((result) => {
      if (result.ok) setApps(result.value.sort((a, b) => a.label.localeCompare(b.label)));
      else setError(result.error);
    });
  }, []);

  const visible = useMemo(() => {
    if (!apps) return [];
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.label.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  const toggle = (packageName: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) next.delete(packageName);
      else next.add(packageName);
      return next;
    });
  };

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[21px] font-extrabold text-content">Pick a few apps to notice</h2>
        <p className="text-sm leading-relaxed text-content-secondary">
          Start small — one or two is plenty. Your app list stays on your phone.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search apps"
        className="h-11 rounded-full border border-border bg-surface px-4 text-sm text-content outline-none focus:border-primary"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {apps === null && !error ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      ) : (
        <div className="max-h-[52vh] overflow-y-auto rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
          {visible.map((app, i) => {
            const selected = chosen.has(app.packageName);
            return (
              <button
                key={app.packageName}
                type="button"
                onClick={() => toggle(app.packageName)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                  i > 0 ? 'border-t border-border-light' : ''
                }`}
              >
                <AppIcon app={app} />
                <span className="flex-1 truncate text-[15px] font-bold text-content">
                  {app.label}
                </span>
                <Icon
                  icon={
                    selected ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'
                  }
                  width={22}
                  className={selected ? 'text-primary' : 'text-content-tertiary/50'}
                />
              </button>
            );
          })}
        </div>
      )}

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
          disabled={busy || chosen.size === 0}
          onClick={() => onSave([...chosen])}
          className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-primary text-base font-bold text-white shadow-[0px_8px_20px_rgba(19,91,235,0.25)] disabled:opacity-50"
        >
          Save ({chosen.size})
        </button>
      </div>
    </div>
  );
}

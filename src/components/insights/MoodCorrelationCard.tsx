import { useEffect, useState } from 'react';
import type { CheckInRecord } from '@/lib/services/data-service.interface';
import { getDataService } from '@/lib/services/service-provider';

const MIN_CHECKINS_FOR_CHART = 3;

const metrics = [
  { key: 'sleep' as const, label: 'Sleep', color: '#135bec', width: 2, dash: '' },
  { key: 'energy' as const, label: 'Energy', color: '#f38601', width: 2, dash: '6 4' },
  { key: 'stress' as const, label: 'Stress', color: '#8a38f5', width: 1.5, dash: '2 3' },
  { key: 'mood' as const, label: 'Mood', color: '#94a3b8', width: 1.5, dash: '2 3' },
] as const;

type MetricKey = (typeof metrics)[number]['key'];

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 3) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    denA = 0,
    denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA,
      db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function getCorrelationLabel(records: CheckInRecord[]): { text: string; hasData: boolean } {
  const complete = records.filter(
    (r) => r.sleep != null && r.energy != null && r.stress != null && r.mood != null,
  );
  if (complete.length < 3) return { text: 'Not Enough Data', hasData: false };
  const vals: Record<MetricKey, number[]> = { sleep: [], energy: [], stress: [], mood: [] };
  for (const r of complete) {
    vals.sleep.push(r.sleep!);
    vals.energy.push(r.energy!);
    vals.stress.push(r.stress!);
    vals.mood.push(r.mood!);
  }
  const keys: MetricKey[] = ['sleep', 'energy', 'stress', 'mood'];
  let sum = 0,
    count = 0;
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      sum += Math.abs(pearson(vals[keys[i]], vals[keys[j]]));
      count++;
    }
  }
  const avg = sum / count;
  if (avg >= 0.5) return { text: 'High Correlation', hasData: true };
  if (avg >= 0.25) return { text: 'Moderate', hasData: true };
  return { text: 'Low Correlation', hasData: true };
}

export function MoodCorrelationCard() {
  const [records, setRecords] = useState<CheckInRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ds = await getDataService();
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const data = await ds.getCheckIns(start, end);
        if (!cancelled) setRecords(data);
      } catch {
        if (!cancelled) setRecords([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (records === null) return null;

  const chartRecords = records
    .filter((r) => r.sleep != null || r.energy != null || r.stress != null || r.mood != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const hasEnoughData = chartRecords.length >= MIN_CHECKINS_FOR_CHART;
  const correlation = getCorrelationLabel(chartRecords);

  const W = 300,
    H = 128,
    PAD = 8;

  function metricPath(key: MetricKey): string {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < chartRecords.length; i++) {
      const val = chartRecords[i][key];
      if (val == null) continue;
      const x = chartRecords.length === 1 ? W / 2 : (i / (chartRecords.length - 1)) * W;
      const y = PAD + ((5 - val) / 4) * (H - PAD * 2);
      points.push({ x, y });
    }
    return buildSmoothPath(points);
  }

  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="text-[16px] font-bold leading-6 text-content">Mood Correlation</h3>
        <span className="rounded-[6px] bg-primary/10 px-2 py-1 text-[12px] font-bold leading-4 text-primary">
          {correlation.text}
        </span>
      </div>
      <div className="flex flex-col gap-6 rounded-2xl border border-border-light bg-surface p-5 shadow-sm">
        <div className="flex gap-4">
          {metrics.map((m) => (
            <div key={m.key} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-[12px] font-semibold leading-4 text-content-secondary">
                {m.label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-[128px]">
          {hasEnoughData ? (
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {metrics.map((m) => (
                <path
                  key={m.key}
                  d={metricPath(m.key)}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={m.width}
                  strokeDasharray={m.dash || undefined}
                />
              ))}
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-sm text-content-tertiary">
                Log a few more check-ins to see your trends
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UsageBarChartProps {
  bars: number[];
  labels: string[];
}

// Placeholder for the on-device DeviceActivityReport render. On iOS the real
// chart comes from the sandboxed report extension; this mirrors its look.
export function UsageBarChart({ bars, labels }: UsageBarChartProps) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex h-[92px] items-end gap-1">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col justify-end">
            <div
              className={`rounded-t ${h >= 88 ? 'bg-primary' : 'bg-primary/25'}`}
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        {labels.map((lb) => (
          <span key={lb} className="text-[11px] font-bold text-content-tertiary">
            {lb}
          </span>
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[10.5px] text-content-tertiary">
        on device: Apple DeviceActivityReport renders here
      </p>
    </div>
  );
}

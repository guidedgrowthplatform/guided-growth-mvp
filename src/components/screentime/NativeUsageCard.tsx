import { useEffect, useRef } from 'react';
import {
  attachUsageReport,
  detachUsageReport,
  setUsageReportRange,
  updateUsageReportRect,
  type UsageReportRange,
} from '@/lib/services/screenTime';

interface NativeUsageCardProps {
  range: UsageReportRange;
  /** Card height in px — native view fills the placeholder exactly. */
  height?: number;
}

// Placeholder the native DeviceActivityReport view is positioned over
// (Maps-style overlay). Display-only: native side passes touches through.
export function NativeUsageCard({ range, height = 280 }: NativeUsageCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const attached = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = { x: 0, y: 0, width: 0, height: 0 };

    const measure = () => {
      const el = ref.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };

    const tick = () => {
      const rect = measure();
      if (rect && attached.current) {
        if (
          rect.x !== last.x ||
          rect.y !== last.y ||
          rect.width !== last.width ||
          rect.height !== last.height
        ) {
          last = rect;
          void updateUsageReportRect(rect);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const start = async () => {
      const rect = measure();
      if (!rect) return;
      last = rect;
      const result = await attachUsageReport(rect, range);
      if (result.ok) {
        attached.current = true;
        raf = requestAnimationFrame(tick);
      }
    };

    void start();
    return () => {
      cancelAnimationFrame(raf);
      if (attached.current) {
        attached.current = false;
        void detachUsageReport();
      }
    };
    // attach once per mount — range changes go through setUsageReportRange below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (attached.current) void setUsageReportRange(range);
  }, [range]);

  return (
    <div
      ref={ref}
      style={{ height }}
      className="rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]"
    />
  );
}

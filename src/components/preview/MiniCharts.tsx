import { useId } from 'react';

// Lightweight, dependency-free SVG charts for the design mocks, styled to the
// app's tokens (primary line, soft area fill). A LineChart with an optional
// highlighted point + value pill and a dashed projection tail, and a tiny
// Sparkline for list rows. Brand blue, not the reference's orange.

interface LineChartProps {
  data: number[];
  labels?: string[];
  /** Index to highlight with a dot + value pill + dashed guide. */
  highlight?: number;
  /** Number of leading points that are actual; the rest render dashed (projection). */
  solidCount?: number;
  height?: number;
  formatValue?: (v: number) => string;
}

export function LineChart({
  data,
  labels = [],
  highlight,
  solidCount,
  height = 156,
  formatValue = (v) => `${v}`,
}: LineChartProps) {
  const gradId = useId();
  const W = 320;
  const H = height;
  const padX = 18;
  const padTop = 30;
  const padBottom = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const x = (i: number) => padX + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padTop + (1 - (v - min) / range) * innerH;

  const pts = data.map((v, i) => [x(i), y(v)] as const);
  const toPath = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' ');

  const solidEnd = solidCount != null ? solidCount - 1 : data.length - 1;
  const solidPath = toPath(0, solidEnd);
  const dashPath = solidEnd < data.length - 1 ? toPath(solidEnd, data.length - 1) : '';
  const areaPath = `${toPath(0, data.length - 1)} L ${x(data.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={solidPath}
        fill="none"
        stroke="rgb(var(--color-primary))"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dashPath && (
        <path
          d={dashPath}
          fill="none"
          stroke="rgb(var(--color-primary))"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="2 5"
          opacity={0.55}
        />
      )}

      {labels.map((l, i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 7}
          textAnchor="middle"
          className="fill-[rgb(var(--color-content-tertiary))]"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          {l}
        </text>
      ))}

      {highlight != null && (
        <g>
          <line
            x1={x(highlight)}
            y1={padTop - 6}
            x2={x(highlight)}
            y2={padTop + innerH}
            stroke="rgb(var(--color-content-tertiary))"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.5}
          />
          <circle
            cx={x(highlight)}
            cy={y(data[highlight])}
            r={4.5}
            fill="rgb(var(--color-primary))"
          />
          <circle
            cx={x(highlight)}
            cy={y(data[highlight])}
            r={8}
            fill="rgb(var(--color-primary))"
            opacity={0.15}
          />
          <g transform={`translate(${x(highlight)}, ${padTop - 16})`}>
            <rect x={-20} y={-11} width={40} height={20} rx={10} fill="rgb(var(--color-content))" />
            <text
              x={0}
              y={3}
              textAnchor="middle"
              className="fill-white"
              style={{ fontSize: 11, fontWeight: 700 }}
            >
              {formatValue(data[highlight])}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Tailwind text color class, e.g. "text-emerald-500". Line uses currentColor. */
  className?: string;
}

export function Sparkline({
  data,
  width = 72,
  height = 26,
  className = 'text-primary',
}: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const path = data
    .map((v, i) => {
      const px = (i / (data.length - 1)) * (width - 4) + 2;
      const py = height - 3 - ((v - min) / range) * (height - 6);
      return `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width - 4 + 2}
        cy={height - 3 - ((data[data.length - 1] - min) / range) * (height - 6)}
        r={2.5}
        fill="currentColor"
      />
    </svg>
  );
}

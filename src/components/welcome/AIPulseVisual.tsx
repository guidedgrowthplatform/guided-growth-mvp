import type { CSSProperties } from 'react';

const ring = (opacity: number): CSSProperties => ({
  ['--ripple-opacity' as string]: String(opacity),
  opacity,
});

export function AIPulseVisual() {
  return (
    <div className="relative flex size-[240px] items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border border-ripple motion-safe:animate-ripple-slow"
        style={ring(0.15)}
      />
      <div
        aria-hidden
        className="absolute inset-[8.33%] rounded-full border border-ripple motion-safe:animate-ripple-med"
        style={ring(0.25)}
      />
      <div
        aria-hidden
        className="absolute inset-[16.67%] rounded-full border border-ripple motion-safe:animate-ripple-fast"
        style={ring(0.4)}
      />
      <div
        className="relative flex size-[96px] items-center justify-center rounded-full bg-white"
        style={{ boxShadow: '0 24px 48px -4px rgba(10, 26, 68, 0.08)' }}
      >
        <img src="/logo.svg" alt="" className="h-9 w-auto" />
      </div>
    </div>
  );
}

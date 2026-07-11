import type { CSSProperties } from 'react';

interface BreathCircleProps {
  /** Slows/pauses the pulse when not actively playing. */
  active: boolean;
}

const ring = (opacity: number): CSSProperties => ({
  ['--ripple-opacity' as string]: String(opacity),
  opacity,
});

/**
 * A calm, single-purpose breathing circle for the Reset player. Deliberately
 * quiet -- no icons, no busy motion -- reusing the same ripple keyframes as
 * AIPulseVisual (tailwind.config.js `ripple-slow/med/fast`) so it feels like
 * it belongs to the same visual language, just slowed and stilled when paused.
 */
export function BreathCircle({ active }: BreathCircleProps) {
  const motionClass = active ? 'motion-safe:animate-ripple-slow' : '';
  return (
    <div className="relative flex size-[220px] items-center justify-center">
      <div
        aria-hidden
        className={`absolute inset-0 rounded-full border border-primary ${motionClass}`}
        style={ring(0.12)}
      />
      <div
        aria-hidden
        className={`absolute inset-[10%] rounded-full border border-primary ${motionClass}`}
        style={ring(0.2)}
      />
      <div
        aria-hidden
        className="relative flex size-[140px] items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5"
      />
    </div>
  );
}

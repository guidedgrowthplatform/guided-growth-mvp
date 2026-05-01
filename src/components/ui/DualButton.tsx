import { type CSSProperties, type ReactNode } from 'react';

type ActiveSide = 'left' | 'right' | 'both';

interface DualButtonProps {
  leftIcon: ReactNode;
  rightIcon: ReactNode;
  leftActive?: boolean;
  rightActive?: boolean;
  size?: number;
  width?: number;
  className?: string;
  ariaLabel?: string;
  onLeftClick?: () => void;
  onRightClick?: () => void;
  leftAriaLabel?: string;
  rightAriaLabel?: string;
  /** Full concentric rings around the whole dial (static decoration). */
  rings?: boolean;
  /** Side-specific pulsing arc rings for an active speaking state. */
  activeRings?: ActiveSide | null;
  ringCount?: number;
  ringStep?: number;
  /** 0..1 — drives ring pulse amplitude (`--pulse-scale`). Defaults to 0.05 base. */
  intensity?: number;
}

const DEFAULT_RING_STEP = 28;
const DEFAULT_ACTIVE_RING_STEP = 6;
const DEFAULT_RING_COUNT = 3;

export function DualButton({
  leftIcon,
  rightIcon,
  leftActive = false,
  rightActive = false,
  size = 187,
  width,
  className,
  ariaLabel,
  onLeftClick,
  onRightClick,
  leftAriaLabel,
  rightAriaLabel,
  rings = false,
  activeRings,
  ringCount = DEFAULT_RING_COUNT,
  ringStep,
  intensity,
}: DualButtonProps) {
  const dialWidth = width ?? size;
  const dialHeight = size;
  const innerRadius = (size * 9.24) / 187;
  const gap = Math.max(5, Math.round(size * 0.06));
  const isInteractive = Boolean(onLeftClick || onRightClick);

  const dial = (
    <div
      className={[
        'pointer-events-auto relative inline-block shrink-0 overflow-hidden rounded-full',
        !rings && activeRings === undefined && className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: dialWidth, height: dialHeight }}
      role={isInteractive ? 'group' : 'img'}
      aria-label={ariaLabel}
    >
      <Half
        side="left"
        active={leftActive}
        gap={gap}
        innerRadius={innerRadius}
        onClick={onLeftClick}
        ariaLabel={leftAriaLabel}
      >
        {leftIcon}
      </Half>
      <Half
        side="right"
        active={rightActive}
        gap={gap}
        innerRadius={innerRadius}
        onClick={onRightClick}
        ariaLabel={rightAriaLabel}
      >
        {rightIcon}
      </Half>
    </div>
  );

  if (activeRings !== undefined) {
    const step = ringStep ?? DEFAULT_ACTIVE_RING_STEP;
    const outerWidth = dialWidth + step * ringCount * 2;
    const outerHeight = dialHeight + step * ringCount * 2;
    return (
      <div
        className={[
          'pointer-events-none relative inline-flex shrink-0 items-center justify-center',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ width: outerWidth, height: outerHeight }}
      >
        {activeRings && (
          <ActiveRings
            side={activeRings}
            dialWidth={dialWidth}
            dialHeight={dialHeight}
            step={step}
            count={ringCount}
            intensity={intensity}
          />
        )}
        {dial}
      </div>
    );
  }

  if (!rings) return dial;

  const fullStep = ringStep ?? DEFAULT_RING_STEP;
  const outerWidth = dialWidth + fullStep * ringCount;
  const outerHeight = dialHeight + fullStep * ringCount;

  return (
    <div
      className={['relative inline-flex shrink-0 items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
      style={{ width: outerWidth, height: outerHeight }}
    >
      {Array.from({ length: ringCount }).map((_, i) => {
        const offset = fullStep * (i + 1);
        return (
          <div
            key={offset}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/70"
            style={{
              width: dialWidth + offset,
              height: dialHeight + offset,
              opacity: 1 - i * 0.25,
            }}
          />
        );
      })}
      {dial}
    </div>
  );
}

interface ActiveRingsProps {
  side: ActiveSide;
  dialWidth: number;
  dialHeight: number;
  step: number;
  count: number;
  intensity?: number;
}

function ActiveRings({ side, dialWidth, dialHeight, step, count, intensity }: ActiveRingsProps) {
  const sides: Array<'left' | 'right'> = side === 'both' ? ['left', 'right'] : [side];
  return (
    <>
      {sides.map((s) => (
        <RingStack
          key={s}
          side={s}
          dialWidth={dialWidth}
          dialHeight={dialHeight}
          step={step}
          count={count}
          intensity={intensity}
        />
      ))}
    </>
  );
}

interface RingStackProps {
  side: 'left' | 'right';
  dialWidth: number;
  dialHeight: number;
  step: number;
  count: number;
  intensity?: number;
}

function RingStack({ side, dialWidth, dialHeight, step, count, intensity }: RingStackProps) {
  const clipPath = side === 'left' ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)';

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const offset = step * (i + 1);
        const ringWidth = dialWidth + offset * 2;
        const ringHeight = dialHeight + offset * 2;
        const opacity = 1 - i * 0.25;
        return (
          <div
            key={`${side}-${offset}`}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              width: ringWidth,
              height: ringHeight,
              transform: 'translate(-50%, -50%)',
              clipPath,
            }}
          >
            <div
              className="h-full w-full animate-ring-pulse rounded-full border border-primary/70"
              style={
                {
                  '--ring-opacity': opacity,
                  '--pulse-scale':
                    intensity != null
                      ? Math.min(0.05 + intensity * 0.1, 0.15)
                      : 0.05,
                  animationDelay: `${i * 0.25}s`,
                } as CSSProperties
              }
            />
          </div>
        );
      })}
    </>
  );
}

interface HalfProps {
  side: 'left' | 'right';
  active: boolean;
  gap: number;
  innerRadius: number;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}

function Half({ side, active, gap, innerRadius, onClick, ariaLabel, children }: HalfProps) {
  const isLeft = side === 'left';
  const className = [
    'absolute inset-y-0 flex items-center justify-center transition-colors duration-200',
    active ? 'bg-primary text-white' : 'bg-slate-400 text-white',
    isLeft ? 'left-0' : 'right-0',
    onClick &&
      'cursor-pointer transition-transform duration-150 hover:brightness-110 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  ]
    .filter(Boolean)
    .join(' ');
  const style = {
    width: `calc(50% - ${gap / 2}px)`,
    borderTopRightRadius: isLeft ? innerRadius : 0,
    borderBottomRightRadius: isLeft ? innerRadius : 0,
    borderTopLeftRadius: isLeft ? 0 : innerRadius,
    borderBottomLeftRadius: isLeft ? 0 : innerRadius,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={className}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

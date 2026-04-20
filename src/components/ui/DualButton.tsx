import { type ReactNode } from 'react';

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
  rings?: boolean;
}

const RING_STEP = 28;
const RING_COUNT = 3;

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
}: DualButtonProps) {
  const dialWidth = width ?? size;
  const dialHeight = size;
  const innerRadius = (size * 9.24) / 187;
  const gap = Math.max(5, Math.round(size * 0.06));
  const isInteractive = Boolean(onLeftClick || onRightClick);

  const dial = (
    <div
      className={[
        'relative inline-block shrink-0 overflow-hidden rounded-full',
        !rings && className,
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

  if (!rings) return dial;

  const outerWidth = dialWidth + RING_STEP * RING_COUNT;
  const outerHeight = dialHeight + RING_STEP * RING_COUNT;

  return (
    <div
      className={['relative inline-flex shrink-0 items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
      style={{ width: outerWidth, height: outerHeight }}
    >
      {Array.from({ length: RING_COUNT }).map((_, i) => {
        const step = RING_STEP * (i + 1);
        return (
          <div
            key={step}
            aria-hidden="true"
            className="absolute rounded-full border border-border/70"
            style={{
              width: dialWidth + step,
              height: dialHeight + step,
              opacity: 1 - i * 0.25,
            }}
          />
        );
      })}
      {dial}
    </div>
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
      'cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
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

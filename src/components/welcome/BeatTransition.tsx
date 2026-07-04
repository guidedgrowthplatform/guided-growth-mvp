import type { CSSProperties, ReactNode } from 'react';

export type BeatTransitionKind =
  | 'dissolve'
  | 'slide-left'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'wipe'
  | 'blur'
  | 'flip';

export const BEAT_TRANSITION_KINDS: BeatTransitionKind[] = [
  'dissolve',
  'slide-left',
  'slide-up',
  'slide-down',
  'zoom-in',
  'zoom-out',
  'wipe',
  'blur',
  'flip',
];

interface Pose {
  opacity?: number;
  transform?: string;
  clipPath?: string;
  filter?: string;
}

// Each kind: the incoming (second) beat's HIDDEN pose, and whether the outgoing
// (first) beat fades out under it. The SHOWN pose is the same for all.
const SECOND_HIDDEN: Record<BeatTransitionKind, { hidden: Pose; firstFades: boolean }> = {
  dissolve: { hidden: { opacity: 0 }, firstFades: true },
  'slide-left': { hidden: { transform: 'translateX(100%)' }, firstFades: false },
  'slide-up': { hidden: { transform: 'translateY(100%)' }, firstFades: false },
  'slide-down': { hidden: { transform: 'translateY(-100%)' }, firstFades: false },
  'zoom-in': { hidden: { opacity: 0, transform: 'scale(0.7)' }, firstFades: true },
  'zoom-out': { hidden: { opacity: 0, transform: 'scale(1.3)' }, firstFades: true },
  wipe: { hidden: { clipPath: 'inset(0 100% 0 0)' }, firstFades: false },
  blur: { hidden: { opacity: 0, filter: 'blur(12px)' }, firstFades: true },
  flip: { hidden: { opacity: 0, transform: 'rotateY(90deg)' }, firstFades: true },
};

const SHOWN: Required<Pose> = {
  opacity: 1,
  transform: 'none',
  clipPath: 'inset(0 0 0 0)',
  filter: 'blur(0px)',
};

interface BeatTransitionProps {
  /** The outgoing beat. */
  first: ReactNode;
  /** The incoming beat. */
  second: ReactNode;
  /** false = show the first beat, true = transitioned to the second. */
  showSecond: boolean;
  /** Which transition plays. */
  kind?: BeatTransitionKind;
  /** Transition duration in ms. */
  durationMs?: number;
}

// A connector that plays a transition BETWEEN two beats, like a transition
// sitting between two clips on a timeline. Drop it between beats and flip
// `showSecond` to play it. The kind picks the motion; because adjacent beats can
// share a pose (the orb) and a mood (the background), a dissolve reads as the
// shared element staying put while the rest swaps.
export function BeatTransition({
  first,
  second,
  showSecond,
  kind = 'dissolve',
  durationMs = 600,
}: BeatTransitionProps) {
  const cfg = SECOND_HIDDEN[kind] ?? SECOND_HIDDEN.dissolve;
  const transition = `opacity ${durationMs}ms ease-out, transform ${durationMs}ms ease-out, clip-path ${durationMs}ms ease-out, filter ${durationMs}ms ease-out`;
  const pose = showSecond ? SHOWN : cfg.hidden;

  const firstStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transition,
    opacity: cfg.firstFades ? (showSecond ? 0 : 1) : 1,
    pointerEvents: showSecond ? 'none' : 'auto',
  };
  const secondStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transition,
    opacity: pose.opacity ?? 1,
    transform: pose.transform ?? 'none',
    clipPath: pose.clipPath,
    filter: pose.filter,
    pointerEvents: showSecond ? 'auto' : 'none',
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        perspective: kind === 'flip' ? 900 : undefined,
      }}
    >
      <div style={firstStyle}>{first}</div>
      <div style={secondStyle}>{second}</div>
    </div>
  );
}

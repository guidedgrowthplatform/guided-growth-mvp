import type { ReactNode } from 'react';

export type BeatTransitionKind = 'dissolve';

interface BeatTransitionProps {
  /** The outgoing beat. */
  first: ReactNode;
  /** The incoming beat. */
  second: ReactNode;
  /** false = show the first beat, true = transitioned to the second. */
  showSecond: boolean;
  /** Transition kind. Only 'dissolve' (cross-fade) for now; more can be added. */
  kind?: BeatTransitionKind;
  /** Cross-fade duration in ms. */
  durationMs?: number;
}

// A connector that plays a transition BETWEEN two beats, like a dissolve sitting
// between two clips on a timeline. Drop it between beats in a flow and flip
// `showSecond` to play it. Because adjacent beats can share a pose (the orb) and
// a mood (the background color), a plain cross-fade reads as the shared element
// staying put while the rest of the screen swaps. No "beat" data or instructions
// doc needed; the connector is just this component.
export function BeatTransition({
  first,
  second,
  showSecond,
  kind = 'dissolve',
  durationMs = 600,
}: BeatTransitionProps) {
  void kind; // dissolve is the only kind for now

  const layer = (node: ReactNode, visible: boolean): ReactNode => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: visible ? 1 : 0,
        transition: `opacity ${durationMs}ms ease-out`,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {node}
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {layer(first, !showSecond)}
      {layer(second, showSecond)}
    </div>
  );
}

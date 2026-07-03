/**
 * openerActivation — pure activation-token logic for the beat-opener audio
 * hooks (extracted so the settle rules are unit-testable without React).
 *
 * Why this exists (B4/B14): useBeatOpenerMp3's effect can run twice for one
 * logical beat activation (React strict-mode double invoke, or a dep-change
 * re-run), and the pooled audio element is SHARED across those runs. With a
 * single shared "settled" flag, run #1's cleanup pause()s the element, the
 * resulting play() AbortError lands asynchronously AFTER run #2 has armed and
 * reset the flag, and the shared settle path then marks run #2 done — so the
 * beat is "done" with zero audio ever reaching a `playing` event. Each
 * activation therefore carries its own token: a stale activation can record
 * itself settled, but can never settle (or touch the audio of) the current one.
 */

export interface OpenerActivation {
  /** Monotonic id per tracker, for logging/debugging. */
  readonly id: number;
  /** True while this activation is the most recently begun on its tracker. */
  isCurrent(): boolean;
  /** True once settle() ran for this activation (whether or not it acted). */
  isSettled(): boolean;
  /**
   * Mark this activation settled. Returns true when the CALLER should perform
   * the settle side effects (pause/release the audio element, flip hook
   * state): that is, only when this activation is still current and was not
   * already settled. A stale or repeated settle returns false — record only,
   * hands off the shared element and the live activation's state.
   */
  settle(): boolean;
}

export interface OpenerActivationTracker {
  /** Start a new activation; every previous one becomes stale immediately. */
  begin(): OpenerActivation;
}

export function createActivationTracker(): OpenerActivationTracker {
  let nextId = 1;
  let currentId = 0;
  return {
    begin(): OpenerActivation {
      const id = nextId;
      nextId += 1;
      currentId = id;
      let settled = false;
      return {
        id,
        isCurrent: () => currentId === id,
        isSettled: () => settled,
        settle() {
          if (settled) return false;
          settled = true;
          return currentId === id;
        },
      };
    },
  };
}

export type OpenerPlayFailureAction = 'ignore' | 'retry' | 'settle';

/**
 * Decide what a rejected play() attempt means for the activation it belongs
 * to. Pure so the exact rules are testable:
 *
 * - A settled or stale activation's rejection is history — ignore it. This is
 *   the B4 race: activation #1's AbortError must never settle activation #2.
 * - Our own teardown (the activation's AbortController fired) also ignores:
 *   the cleanup path already settled state.
 * - An AbortError on the LIVE activation means something paused the shared
 *   element under our pending play() — re-armable, so retry (bounded) instead
 *   of settling the beat done-with-no-audio.
 * - Anything else (NotAllowedError that survived the gesture fallback, decode
 *   errors, ...) settles by failure so the beat never dead-ends.
 */
export function classifyOpenerPlayFailure(opts: {
  errorName: string | null | undefined;
  isCurrent: boolean;
  isSettled: boolean;
  /** True when this activation's own teardown AbortController fired. */
  teardownAborted: boolean;
  retriesLeft: number;
}): OpenerPlayFailureAction {
  if (opts.isSettled || !opts.isCurrent || opts.teardownAborted) return 'ignore';
  if (opts.errorName === 'AbortError' && opts.retriesLeft > 0) return 'retry';
  return 'settle';
}

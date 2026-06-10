//
// Dev-only console trace of the AI turn pipeline. A debugging aid, nothing more.
//
// It exists so we can SEE what the coach actually does each turn (which tool it
// picked, with what arguments, what came back, and how long the whole turn took)
// instead of only seeing the final reply. It does NOT change app behavior: when
// tracing is off, startTurnTrace is never called and nothing is logged.
//
// Enable:  add ?debug=1 to the URL, OR run  localStorage.setItem('gg_debug','1')
//          in the console (persists across reloads).
// Disable: remove the ?debug=1, or run  localStorage.removeItem('gg_debug').
// Note:    the on/off state is read once per page load, so reload after toggling.

let cached: boolean | null = null;

export function isTraceOn(): boolean {
  if (cached !== null) return cached;
  try {
    const params = new URLSearchParams(window.location.search);
    cached = params.get('debug') === '1' || window.localStorage.getItem('gg_debug') === '1';
  } catch {
    cached = false;
  }
  return cached;
}

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export interface TurnTrace {
  /** Log one step within the turn, stamped with elapsed time since the turn started. */
  event(label: string, data?: unknown): void;
  /** Close the turn group and log the total wall-clock time. */
  end(): void;
}

let seq = 0;

/**
 * Open a collapsed console group for one AI turn. Call event() for each step and
 * end() once when the turn finishes. Only call this when isTraceOn() is true.
 */
export function startTurnTrace(title: string, request?: unknown): TurnTrace {
  const id = ++seq;
  const t0 = clock();
  const at = (): string => `+${Math.round(clock() - t0)}ms`;

  try {
    console.groupCollapsed(`%c[AI turn ${id}] ${title}`, 'color:#7F77DD;font-weight:600');
    if (request !== undefined) console.log('request', request);
  } catch {
    // ignore console failures
  }

  return {
    event(label, data) {
      try {
        if (data !== undefined) console.log(`${at()}  ${label}`, data);
        else console.log(`${at()}  ${label}`);
      } catch {
        // ignore
      }
    },
    end() {
      try {
        console.log(`total ${Math.round(clock() - t0)}ms`);
        console.groupEnd();
      } catch {
        // ignore
      }
    },
  };
}

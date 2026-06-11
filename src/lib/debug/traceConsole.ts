//
// Console trace of the AI turn pipeline. A debugging aid, nothing more.
//
// It exists so we can SEE what the coach actually does each turn (which tool it
// picked, with what arguments, what came back, and how long the whole turn took)
// instead of only seeing the final reply. It does NOT change app behavior: when
// tracing is off, startTurnTrace is never called and nothing is logged.
//
// Environment-aware (so production stays clean):
//   - QA / staging: the build sets VITE_DEBUG_TRACE=auto, so the trace is ON for
//     every session with no opt-in. This is the team-facing visibility surface.
//   - Local dev:    manual opt-in. Add ?debug=1 to the URL, OR run
//                   localStorage.setItem('gg_debug','1') (persists across reloads).
//                   Disable by removing ?debug=1 or localStorage.removeItem('gg_debug').
//   - Production:   hard off. VITE_DEBUG_TRACE is unset and DEV is false, so the
//                   checks below fold to `return false` at build time (Vite inlines
//                   import.meta.env), the bundle dead-code-eliminates the trace, and
//                   ?debug=1 / localStorage cannot turn it on.
//
// Note: the on/off state is read once per page load, so reload after toggling.

let cached: boolean | null = null;

export function isTraceOn(): boolean {
  if (cached !== null) return cached;
  cached = computeTraceOn();
  return cached;
}

function computeTraceOn(): boolean {
  // QA / staging builds opt the whole environment in.
  if (import.meta.env.VITE_DEBUG_TRACE === 'auto') return true;
  // Anything that is not a local dev build (i.e. production) is hard off. Both
  // import.meta.env.VITE_DEBUG_TRACE and import.meta.env.DEV are inlined at build
  // time, so in a production bundle this folds to a constant `false` and the
  // manual opt-in below is stripped.
  if (!import.meta.env.DEV) return false;
  // Local dev: manual opt-in only.
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === '1' || window.localStorage.getItem('gg_debug') === '1';
  } catch {
    return false;
  }
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

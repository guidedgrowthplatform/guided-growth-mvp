import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Sentinel value used to pin the page in the history stack while the guard
// is active. We push a state entry with this marker so the very next
// `popstate` (hardware back, browser back, iOS swipe-back) lands on our
// sentinel and we can intercept the intent.
export const GUARD_STATE_KEY = '__navGuardSentinel';

/**
 * Block in-app navigation away from the current route while `active` is true.
 *
 * Covers:
 *  - React Router `<Link>` clicks (intercepts at the DOM level — capture-phase
 *    click on internal `<a>` elements with an href pointing somewhere else).
 *  - Hardware back / browser back / iOS swipe-back (pushes a sentinel history
 *    entry; on popstate, re-pushes the sentinel and calls onAttempt(null)).
 *
 * Does NOT cover programmatic `navigate()` calls from other components.
 * react-router v6 with `BrowserRouter` (i.e. not the data router) exposes no
 * API to block those — only `RouterProvider` + `createBrowserRouter` enables
 * `useBlocker`, which this app does not use.
 *
 * @param active  When true, navigation attempts are intercepted.
 * @param onAttempt  Called with the destination URL the user tried to reach
 *                   (relative to origin, e.g. `/home`), or `null` if the
 *                   intent was a back-navigation (popstate).
 */
export function useNavigationGuard(
  active: boolean,
  onAttempt: (intendedTo: string | null) => void,
): void {
  const { pathname, search, hash } = useLocation();
  // Hold the latest callback in a ref so listeners don't re-bind every render.
  const onAttemptRef = useRef(onAttempt);
  useEffect(() => {
    onAttemptRef.current = onAttempt;
  }, [onAttempt]);

  // Track the canonical URL we want the user to stay on while guarded, so
  // popstate can re-pin it.
  const guardedHrefRef = useRef<string>(pathname + search + hash);
  useEffect(() => {
    guardedHrefRef.current = pathname + search + hash;
  }, [pathname, search, hash]);

  useEffect(() => {
    if (!active) return;

    // Push a sentinel entry so the next popstate lands here instead of
    // unmounting the page. We tag it so we don't double-push on re-entry.
    const currentState =
      typeof window.history.state === 'object' && window.history.state !== null
        ? window.history.state
        : {};
    if (!currentState[GUARD_STATE_KEY]) {
      window.history.pushState(
        { ...currentState, [GUARD_STATE_KEY]: true },
        '',
        guardedHrefRef.current,
      );
    }

    const handlePopState = () => {
      // The browser popped our sentinel — user is trying to go back. Re-push
      // it so we stay on this URL, then ask the page what to do.
      window.history.pushState(
        { ...(window.history.state ?? {}), [GUARD_STATE_KEY]: true },
        '',
        guardedHrefRef.current,
      );
      onAttemptRef.current(null);
    };

    const handleClick = (e: MouseEvent) => {
      // Ignore modified clicks (open-in-new-tab, etc.) and non-primary buttons.
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Walk up the composed path to find the nearest <a>.
      const path = e.composedPath();
      let anchor: HTMLAnchorElement | null = null;
      for (const node of path) {
        if (node instanceof HTMLAnchorElement) {
          anchor = node;
          break;
        }
      }
      if (!anchor) return;
      // Only intercept same-origin links the router would handle.
      if (anchor.target && anchor.target !== '_self') return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      // Skip external schemes and pure-hash links on the same page.
      if (/^([a-z]+:)?\/\//i.test(href)) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const intendedTo = url.pathname + url.search + url.hash;
      // No-op if it points to the same place we're guarding.
      if (intendedTo === guardedHrefRef.current) return;

      // preventDefault stops the router nav; do NOT stopPropagation —
      // the link's own onClick (e.g. BottomNav analytics) should still fire.
      e.preventDefault();
      onAttemptRef.current(intendedTo);
    };

    window.addEventListener('popstate', handlePopState);
    // Capture phase so we run before React Router's own click handler.
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
      // Pop the sentinel if it's still the top entry — checking the marker
      // keeps us from popping a real navigation. Without this, every Keep
      // focusing + every natural completion leaks one /focus history entry.
      const state = window.history.state;
      if (state && typeof state === 'object' && state[GUARD_STATE_KEY]) {
        window.history.back();
      }
    };
  }, [active]);
}

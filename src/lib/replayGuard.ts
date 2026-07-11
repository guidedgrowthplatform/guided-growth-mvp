// Central kill switch for session replay (Sentry now; PostHog reuses this when
// its replay is enabled). Replay quota is scarce (Sentry free plan is 50
// replays per billing cycle), so keeping QA and simulated sessions out of it
// is the whole point. Three ways to disable, checked in order:
//   1. Build flag VITE_DISABLE_REPLAY=1. QA fleet and TestFlight/APK builds set
//      this in qa-release.yml, so automated runs never record.
//   2. URL flag ?noreplay=1. For browser QA on a normal preview or prod build,
//      where the session is indistinguishable from a real user. The flag is
//      sticky (stored in localStorage) so it survives navigation for the rest
//      of that browser's testing. Append ?noreplay=0 to clear it.
//   3. The sticky localStorage flag set by (2).

const STICKY_KEY = 'gg_disable_replay';

export function isReplayDisabled(): boolean {
  if (import.meta.env.VITE_DISABLE_REPLAY === '1') return true;
  try {
    const flag = new URLSearchParams(window.location.search).get('noreplay');
    if (flag === '1') {
      localStorage.setItem(STICKY_KEY, '1');
      return true;
    }
    if (flag === '0') {
      localStorage.removeItem(STICKY_KEY);
      return false;
    }
    return localStorage.getItem(STICKY_KEY) === '1';
  } catch {
    return false;
  }
}

// SPA nav strips ?debug before the first traced turn reads it — persist to win.
export function captureDebugFlag(): void {
  try {
    const v = new URLSearchParams(window.location.search).get('debug');
    if (v === '1') localStorage.setItem('gg_debug', '1');
    else if (v === '0') localStorage.removeItem('gg_debug');
    if (localStorage.getItem('gg_debug') === '1') {
      console.info(
        '%c[gg-debug] enabled — AI turns + onboarding events log here (?debug=0 to disable)',
        'color:#7F77DD;font-weight:600',
      );
    }
  } catch {
    // no window/storage → noop
  }
}

// Boot-time capture of ?debug=1|0 into localStorage. SPA navigation strips
// query params before the first traced turn reads them — persisting wins.
const KEYS = ['gg_debug', 'gg_onboarding_debug'];

export function captureDebugFlag(): void {
  try {
    const v = new URLSearchParams(window.location.search).get('debug');
    if (v === '1') KEYS.forEach((k) => localStorage.setItem(k, '1'));
    else if (v === '0') KEYS.forEach((k) => localStorage.removeItem(k));
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

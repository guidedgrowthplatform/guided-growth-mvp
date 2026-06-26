// Floating "QA" button shown on EVERY screen in QA builds only. Jumps back to the
// QA control launcher (/onboarding/qa) so a tester can reset or switch user from
// anywhere, without typing the URL. Gated by VITE_QA_SCREEN_ENABLED (or dev), so
// it renders nothing in a normal production build. A plain link on purpose: it
// does a clean full navigation to the launcher.

const QA_FAB_ENABLED =
  import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

export function QAFab() {
  if (!QA_FAB_ENABLED) return null;
  return (
    <a
      href="/onboarding/qa"
      aria-label="Back to QA control"
      title="QA control (reset / switch user)"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        right: 8,
        zIndex: 2147483647,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 30,
        padding: '0 11px',
        borderRadius: 999,
        background: 'rgb(220,38,38)',
        color: '#fff',
        fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textDecoration: 'none',
        boxShadow: '0 6px 18px -5px rgba(0,0,0,0.4)',
        opacity: 0.9,
        userSelect: 'none',
      }}
    >
      ↺ QA
    </a>
  );
}

export default QAFab;

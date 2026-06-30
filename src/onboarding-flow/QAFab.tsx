// Floating "QA" button shown on EVERY screen in QA builds only. Signs the tester
// OUT (clears the Supabase session + caches) and then does a clean full navigation
// to the QA control launcher (/onboarding/qa), so a tester always lands there
// fresh — not still logged in as the previous user. Gated by VITE_QA_SCREEN_ENABLED
// (or dev), so it renders nothing in a normal production build.

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const QA_FAB_ENABLED = import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

export function QAFab() {
  const signOut = useAuthStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  if (!QA_FAB_ENABLED) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch {
      // Best effort: even if the remote signout fails, still leave for the
      // launcher so the tester is never stranded on the authed flow.
    }
    // Full navigation (not a SPA route) so all in-memory state is dropped too —
    // the launcher then loads with a clean slate.
    window.location.assign('/onboarding/qa');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Sign out and go to QA control"
      title="QA control (sign out / reset / switch user)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 30,
        padding: '0 11px',
        border: 'none',
        borderRadius: 999,
        background: 'rgb(220,38,38)',
        color: '#fff',
        fontFamily: 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textDecoration: 'none',
        boxShadow: '0 6px 18px -5px rgba(0,0,0,0.4)',
        opacity: busy ? 0.6 : 0.9,
        cursor: busy ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {busy ? '↺ …' : '↺ QA'}
    </button>
  );
}

export default QAFab;

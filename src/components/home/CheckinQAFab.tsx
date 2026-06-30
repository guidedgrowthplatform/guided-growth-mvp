// QA-only FAB to wipe today's check-in. Gated by VITE_QA_SCREEN_ENABLED (or dev).

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { resetCheckinTodayQA } from '@/api/checkinTool';
import { useToast } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';

const QA_FAB_ENABLED = import.meta.env.VITE_QA_SCREEN_ENABLED === 'true' || import.meta.env.DEV;

export function CheckinQAFab() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!QA_FAB_ENABLED) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await resetCheckinTodayQA();
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.checkins.all }),
        qc.invalidateQueries({ queryKey: queryKeys.habits.all }),
        qc.invalidateQueries({ queryKey: queryKeys.journal.all }),
      ]);
      addToast('success', "Today's check-in reset");
    } catch {
      addToast('error', 'Check-in reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Reset today's check-in"
      title="QA: reset today's check-in"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        left: 8,
        zIndex: 2147483647,
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
        boxShadow: '0 6px 18px -5px rgba(0,0,0,0.4)',
        opacity: busy ? 0.6 : 0.9,
        cursor: busy ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {busy ? '↺ …' : '↺ Check-in'}
    </button>
  );
}

export default CheckinQAFab;

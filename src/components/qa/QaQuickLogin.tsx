import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { isQaSurface } from '@/lib/appVariant';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { QA_TEST_USERS, qaApiBase } from './qaApi';

export function QaQuickLogin() {
  const [visible, setVisible] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isQaSurface().then(setVisible);
  }, []);

  if (!visible) return null;

  const login = async (email: string) => {
    setError(null);
    setPendingEmail(email);
    try {
      if (useAuthStore.getState().user) await useAuthStore.getState().signOut();

      const res = await fetch(`${qaApiBase()}/api/qa-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Login failed (${res.status})`);
      }
      const { hashed_token: tokenHash } = (await res.json()) as { hashed_token: string };

      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      if (otpError) throw new Error(otpError.message);
      // onAuthStateChange + AppGate route from here.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setPendingEmail(null);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-dashed border-border p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-secondary">
        QA quick login
      </p>
      <div className="grid grid-cols-2 gap-2">
        {QA_TEST_USERS.map(({ name, email }) => (
          <Button
            key={email}
            variant="secondary"
            size="md"
            loading={pendingEmail === email}
            disabled={pendingEmail !== null}
            onClick={() => void login(email)}
          >
            {name}
          </Button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

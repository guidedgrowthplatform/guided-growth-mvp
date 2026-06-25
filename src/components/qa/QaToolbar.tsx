import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authedFetch } from '@/api/authedFetch';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { isQaSurface } from '@/lib/appVariant';
import { queryClient } from '@/lib/query';
import { queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/stores/authStore';
import { qaApiBase } from './qaApi';

export function QaToolbar() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void isQaSurface().then(setVisible);
  }, []);

  if (!visible || !user) return null;

  const reset = async () => {
    setResetting(true);
    try {
      const res = await authedFetch(`${qaApiBase()}/api/qa-reset`, { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Reset failed (${res.status})`);
      }
      // refetch (not invalidate) so re-route doesn't depend on an active observer.
      await queryClient.refetchQueries({ queryKey: queryKeys.onboarding.state });
      addToast('success', 'Onboarding reset');
      navigate('/onboarding');
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-3 z-[80]">
      <Button variant="danger" size="sm" loading={resetting} onClick={() => void reset()}>
        Reset onboarding
      </Button>
    </div>
  );
}

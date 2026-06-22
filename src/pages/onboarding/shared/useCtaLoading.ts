import { useCallback, useState } from 'react';

// Re-entry guard + pending flag for async bottom-CTA handlers.
export function useCtaLoading(action: () => Promise<void>) {
  const [loading, setLoading] = useState(false);
  const run = useCallback(() => {
    if (loading) return;
    setLoading(true);
    action()
      .catch((err) => console.error('[onboarding-cta]', err))
      .finally(() => setLoading(false));
  }, [action, loading]);
  return { loading, run };
}

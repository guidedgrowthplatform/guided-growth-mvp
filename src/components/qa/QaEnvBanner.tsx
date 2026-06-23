import { useEffect } from 'react';
import { useIsQaEnvironment } from '@/lib/qaEnv';

const GIT_SHA = (import.meta.env.VITE_GIT_SHA ?? '').slice(0, 7);

// Persistent strip so testers never mistake QA for prod. QA-only: renders null
// in production (flag unset + native app id not .staging).
export function QaEnvBanner() {
  const isQa = useIsQaEnvironment();

  useEffect(() => {
    if (!isQa) return;
    const prev = document.body.style.paddingTop;
    document.body.style.paddingTop = 'calc(1.5rem + env(safe-area-inset-top))';
    return () => {
      document.body.style.paddingTop = prev;
    };
  }, [isQa]);

  if (!isQa) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 pb-1 pt-[max(0.25rem,env(safe-area-inset-top))] text-center text-xs font-semibold text-black"
    >
      STAGING / QA{GIT_SHA ? ` · ${GIT_SHA}` : ''} — not production data
    </div>
  );
}

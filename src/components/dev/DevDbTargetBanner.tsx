import { classifyTarget } from '@gg/shared/env/projectRefs';

export function DevDbTargetBanner() {
  if (!import.meta.env.DEV) return null;
  if (classifyTarget(import.meta.env.VITE_SUPABASE_URL ?? '') !== 'prod') return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[2147483647] flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white shadow-lg"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      ⚠ Local dev pointed at production database
    </div>
  );
}

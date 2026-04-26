import type { ApiError } from '@/api/client';

interface ReflectionLoadErrorProps {
  error: ApiError | null;
  onBack: () => void;
  onRetry: () => void;
  onSignIn: () => void;
  variant?: 'card' | 'fullscreen';
}

export function ReflectionLoadError({
  error,
  onBack,
  onRetry,
  onSignIn,
  variant = 'card',
}: ReflectionLoadErrorProps) {
  const status = error?.status ?? 0;
  const wrapperClass =
    variant === 'fullscreen'
      ? 'flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center'
      : 'flex flex-col items-center gap-3 rounded-2xl bg-surface-secondary px-6 py-10 text-center';

  if (status === 404) {
    return (
      <div className={wrapperClass}>
        <p className="text-base font-semibold text-content">Reflection not found</p>
        <p className="max-w-sm text-sm text-content-secondary">
          It may have been deleted, or this link is from a different account.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          Back to Reflections
        </button>
      </div>
    );
  }

  if (status === 401 || status === 403) {
    return (
      <div className={wrapperClass}>
        <p className="text-base font-semibold text-content">You're signed out</p>
        <p className="max-w-sm text-sm text-content-secondary">
          Sign back in to view this reflection.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <p className="text-base font-semibold text-content">Something went wrong</p>
      <p className="max-w-sm text-sm text-content-secondary">
        Check your connection and try again.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onBack}
          className="bg-surface-raised rounded-xl px-5 py-2 text-sm font-semibold text-content"
        >
          Back
        </button>
      </div>
    </div>
  );
}

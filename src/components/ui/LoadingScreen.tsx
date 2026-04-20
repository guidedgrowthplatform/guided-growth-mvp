import { LoadingSpinner } from './LoadingSpinner';

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface">
      <img src="/logo.svg" alt="Guided Growth" className="h-14 w-auto" />
      <LoadingSpinner size="md" className="mt-8" />
    </div>
  );
}

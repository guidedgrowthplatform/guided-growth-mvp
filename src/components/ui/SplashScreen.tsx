import { LoadingSpinner } from './LoadingSpinner';

export function SplashScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface-secondary">
      <h1 className="text-2xl font-bold text-primary">Guided Growth</h1>
      <LoadingSpinner size="sm" className="mt-4" />
    </div>
  );
}

import { LoadingSpinner } from './LoadingSpinner';

// Splash voice disabled — browser autoplay policy blocks audio before
// user interaction. Will re-enable after implementing click-to-play UX.
// MP3 files are ready in public/voice/splash_welcome.mp3

export function SplashScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface-secondary">
      <h1 className="text-2xl font-bold text-primary">Guided Growth</h1>
      <LoadingSpinner size="sm" className="mt-4" />
    </div>
  );
}

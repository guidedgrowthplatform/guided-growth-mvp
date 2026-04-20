import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function SplashScreenPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/welcome', { replace: true });
    }, 8000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center bg-page px-6 py-16">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-bg">
          <img src="/logo.svg" alt="" className="h-12 w-auto" />
        </div>
        <h1 className="mt-6 text-[28px] font-bold text-primary">Guided Growth</h1>
      </div>

      <div className="flex flex-col items-center pb-6">
        <LoadingSpinner size="md" color="text-primary" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-content-tertiary">
          Your AI Coach is ready.
        </p>
      </div>
    </div>
  );
}

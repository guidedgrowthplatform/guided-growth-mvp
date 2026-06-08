import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFooter } from '@/components/auth';
import { AIPulseVisual } from '@/components/welcome/AIPulseVisual';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { isQaBuild } from '@/lib/appVariant';
import { FIRST_OPEN, getFlag, setFlag } from '@/lib/storage/persistentFlags';
import { useAuthStore } from '@/stores/authStore';

export function WelcomePage() {
  const navigate = useNavigate();
  const { play, stop } = useVoicePlayer();
  const signInAsGuest = useAuthStore((s) => s.signInAsGuest);
  const [showGuest, setShowGuest] = useState(false);
  const [guestPending, setGuestPending] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    void isQaBuild().then(setShowGuest);
  }, []);

  const handleGuest = async () => {
    setGuestPending(true);
    setGuestError(null);
    const { error } = await signInAsGuest();
    if (error) {
      setGuestError(error);
      setGuestPending(false);
    }
  };

  useEffect(() => {
    if (getFlag(FIRST_OPEN)) return;
    void play('splash_hook', { deferOnAutoplayBlock: true }).then((played) => {
      if (played) setFlag(FIRST_OPEN, 'true');
    });
    return () => stop();
  }, [play, stop]);

  return (
    <main className="flex min-h-[100dvh] w-full flex-col items-center bg-page px-6 py-[50.5px]">
      <div className="flex w-full max-w-[448px] flex-1 flex-col items-center">
        <h1 className="mt-8 text-[30px] font-bold leading-9 tracking-[-0.75px] text-primary">
          Guided Growth
        </h1>

        <div className="mt-16 flex flex-1 flex-col items-center justify-center">
          <AIPulseVisual />
          <p className="mt-12 px-4 text-center text-[20px] font-semibold leading-[28px] text-heading">
            Hi, I&apos;m your AI Coach. I&apos;m here to help improve your behavior in any area of
            your life that you want!
          </p>
        </div>

        <div className="flex w-full flex-col items-center pt-8">
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="flex h-[60px] w-full max-w-[320px] items-center justify-center rounded-[90px] bg-primary px-8 text-[18px] font-bold leading-7 text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Get Started
          </button>
          {showGuest && (
            <button
              type="button"
              onClick={handleGuest}
              disabled={guestPending}
              className="mt-4 flex h-[60px] w-full max-w-[320px] items-center justify-center rounded-[90px] border border-primary px-8 text-[18px] font-bold leading-7 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {guestPending ? 'Starting…' : 'Start as Guest'}
            </button>
          )}
          {guestError && <p className="mt-2 text-center text-sm text-danger">{guestError}</p>}
          <div className="mt-6">
            <AuthFooter text="Already have an account?" linkText="Log In" to="/login" />
          </div>
        </div>
      </div>
    </main>
  );
}

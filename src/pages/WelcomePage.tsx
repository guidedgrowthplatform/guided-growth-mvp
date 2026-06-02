import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthFooter } from '@/components/auth';
import { AIPulseVisual } from '@/components/welcome/AIPulseVisual';
import { useVoicePlayer } from '@/hooks/useVoicePlayer';
import { FIRST_OPEN, getFlag, setFlag } from '@/lib/storage/persistentFlags';

export function WelcomePage() {
  const navigate = useNavigate();
  const { play, stop } = useVoicePlayer();
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
          <div className="mt-6">
            <AuthFooter text="Already have an account?" linkText="Log In" to="/login" />
          </div>
        </div>
      </div>
    </main>
  );
}

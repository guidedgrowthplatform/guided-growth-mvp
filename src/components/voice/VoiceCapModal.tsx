import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useOnboardingVoice } from '@/contexts/useOnboardingVoiceSession';

export function VoiceCapModal() {
  const session = useOnboardingVoice();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (session?.voiceCapReached) requestAnimationFrame(() => setVisible(true));
  }, [session?.voiceCapReached]);

  if (!session?.voiceCapReached) return null;

  const close = () => {
    setVisible(false);
    setTimeout(() => session.dismissVoiceCap(), 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-200 ${visible ? 'opacity-40' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        className={`relative mx-6 w-full max-w-[360px] rounded-3xl bg-surface p-6 shadow-xl transition-all duration-200 ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Icon icon="material-symbols:mic-off-outline" width={32} className="text-primary" />
          </div>
        </div>

        <h3 className="text-center text-lg font-bold text-content">Live voice paused for today</h3>
        <p className="mt-2 text-center text-sm text-content-secondary">
          You&apos;ve hit today&apos;s voice-chat limit. Two ways to keep going:
        </p>

        <ul className="mt-4 space-y-2 text-sm text-content">
          <li className="flex items-start gap-2">
            <Icon
              icon="material-symbols:chat-outline"
              width={18}
              className="mt-[2px] shrink-0 text-primary"
            />
            <span>
              <strong className="font-semibold">Text chat</strong> — type anytime, no limit.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Icon
              icon="material-symbols:check-circle-outline"
              width={18}
              className="mt-[2px] shrink-0 text-primary"
            />
            <span>
              <strong className="font-semibold">Check-ins</strong> — morning and evening still use voice.
            </span>
          </li>
        </ul>

        <button
          type="button"
          onClick={close}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors active:bg-primary/80"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

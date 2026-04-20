import { Icon } from '@iconify/react';
import { Link, useNavigate } from 'react-router-dom';
import { IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export function AiCoachIntroPage() {
  const navigate = useNavigate();
  const { preferences } = useUserPreferences();
  const voiceEnabled = preferences.voiceEnabled === true;
  const micGranted = preferences.micGranted === true;

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding/mic-permission')}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={18} height={18} className="text-content" />
        </button>
        <Link to="/privacy-policy" className="text-[15px] font-medium text-content-secondary">
          Privacy
        </Link>
      </div>

      <div className="mt-6">
        <h1 className="text-[28px] font-bold leading-tight text-primary">
          I&apos;m your AI Coach.
        </h1>
        <p className="mt-3 text-[15px] leading-[22px] text-content-secondary">
          I&apos;ll help you build routines that actually stick. We&apos;ll be done in about 2 to 5
          minutes, and your data stays private and secure with me.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <DualButton
          size={170}
          width={180}
          rings
          leftActive={voiceEnabled}
          rightActive={micGranted}
          leftIcon={<IconChatVoice size={58} />}
          rightIcon={micGranted ? <IconMic size={48} /> : <IconMicMuted size={48} />}
          ariaLabel="AI coach voice and microphone state"
        />
      </div>

      <div className="flex flex-col items-center gap-[12px]">
        <button
          type="button"
          onClick={() => navigate('/onboarding/step-1')}
          className="flex h-[56px] w-full items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)]"
        >
          I&apos;m ready
        </button>
        <button
          type="button"
          onClick={() => navigate('/onboarding/step-1')}
          className="py-[8px] text-[15px] font-semibold text-content"
        >
          Come back later
        </button>
      </div>
    </div>
  );
}

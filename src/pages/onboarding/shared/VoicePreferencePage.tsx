import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconChatVoice, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useUserPreferences } from '@/hooks/useUserPreferences';

export function VoicePreferencePage() {
  const navigate = useNavigate();
  const { updatePreference } = useUserPreferences();
  const [saving, setSaving] = useState(false);

  const choose = async (voiceEnabled: boolean) => {
    if (saving) return;
    setSaving(true);
    await updatePreference('voiceEnabled', voiceEnabled);
    navigate('/onboarding/mic-permission');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex flex-1 items-center justify-center">
        <DualButton
          size={170}
          width={180}
          leftIcon={<IconChatVoice size={58} />}
          rightIcon={<IconMicMuted size={48} />}
          ariaLabel="Voice preference illustration"
        />
      </div>

      <div>
        <h1 className="text-[28px] font-bold leading-tight text-primary">Can I talk?</h1>
        <p className="mt-3 text-[15px] leading-[22px] text-content-secondary">
          Do you prefer that I talk, or write on the screen to you? If you&apos;d like me to talk,
          just say yes. If not, say screen.
        </p>

        <div className="mt-8 flex flex-col gap-[12px]">
          <button
            type="button"
            onClick={() => choose(true)}
            disabled={saving}
            className="flex h-[56px] items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] transition-opacity disabled:opacity-50"
          >
            Talk to me
          </button>
          <button
            type="button"
            onClick={() => choose(false)}
            disabled={saving}
            className="flex h-[56px] items-center justify-center rounded-full border-2 border-primary bg-surface text-[18px] font-bold text-primary transition-opacity disabled:opacity-50"
          >
            Screen is fine
          </button>
        </div>

        <p className="mt-[14px] text-center text-[13px] text-content-tertiary">
          Interact using text and buttons only.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import type { OnboardingCardApi } from './onboardingCardRegistry';

// Beat 0 — same UI as the routed VoicePreferencePage (orb + Talk/Screen pills),
// rendered inline in the chat. "Talk" enables coach voice-out; "Screen" keeps
// it text. Either choice advances to the profile beat.
export function PreferencesCard({ api }: { api: OnboardingCardApi }) {
  const { preferences } = useUserPreferences();
  // Local-only "has the user picked yet?" — the global default voiceMode is
  // 'voice', so without this the left orb half would render the voice icon
  // before any tap (looks pre-chosen). Stays neutral until first tap.
  const [hasChosen, setHasChosen] = useState(false);
  const voiceChosen = hasChosen && preferences.voiceMode === 'voice';
  const micGranted = preferences.micPermission === true;

  const handlePick = (mode: 'voice' | 'screen') => {
    setHasChosen(true);
    api.submitPreferences?.(mode);
  };

  return (
    <div className="mb-3 mt-2 flex w-full max-w-[360px] flex-col items-center gap-6">
      <DualButton
        size={150}
        width={160}
        leftActive={false}
        rightActive={false}
        leftIcon={
          !hasChosen ? null : voiceChosen ? <IconChatVoice size={52} /> : <IconChatText size={52} />
        }
        rightIcon={micGranted ? <IconMic size={44} /> : <IconMicMuted size={44} />}
        leftAriaLabel="Coach voice indicator"
        rightAriaLabel="Microphone indicator"
      />
      <div className="flex w-full flex-col gap-[12px]">
        <button
          type="button"
          onClick={() => handlePick('voice')}
          disabled={api.busy}
          className="flex h-[56px] items-center justify-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0px_10px_15px_-3px_rgba(19,91,236,0.25),0px_4px_6px_-4px_rgba(19,91,236,0.25)] transition-opacity disabled:opacity-50"
        >
          Talk to me
        </button>
        <button
          type="button"
          onClick={() => handlePick('screen')}
          disabled={api.busy}
          className="flex h-[56px] items-center justify-center rounded-full border-2 border-primary bg-surface text-[18px] font-bold text-primary transition-opacity disabled:opacity-50"
        >
          Screen is fine
        </button>
      </div>
    </div>
  );
}

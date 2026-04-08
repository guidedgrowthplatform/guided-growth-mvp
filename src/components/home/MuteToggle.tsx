import { Icon } from '@iconify/react';
import { useToast } from '@/contexts/ToastContext';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

export function MuteToggle() {
  const { ttsEnabled, setTtsEnabled } = useVoiceSettingsStore();
  const { addToast } = useToast();

  const handleToggle = () => {
    const newState = !ttsEnabled;
    setTtsEnabled(newState);
    addToast('success', newState ? 'Voice enabled' : 'Voice muted');
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={ttsEnabled ? 'Mute voice' : 'Unmute voice'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <Icon
        icon={ttsEnabled ? 'mdi:volume-high' : 'mdi:volume-mute'}
        width={16}
        height={16}
        className="text-primary"
      />
    </button>
  );
}

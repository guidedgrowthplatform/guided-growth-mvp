import { Icon } from '@iconify/react';
import { Link, useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { stopTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import { useAudioMetricsStore } from '@/stores/audioMetricsStore';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { useVoiceStore } from '@/stores/voiceStore';

type NavDestination = 'home' | 'progress' | 'focus' | 'profile';

interface NavTabProps {
  icon: string;
  label: string;
  path: string;
  isActive: boolean;
  destination: NavDestination;
}

function NavTab({ icon, label, path, isActive, destination }: NavTabProps) {
  return (
    <Link
      to={path}
      onClick={() => track('tap_nav_item', { destination })}
      className={`flex flex-col items-center justify-end ${isActive ? 'text-primary' : 'text-content-tertiary'}`}
    >
      <Icon icon={icon} width={24} />
      <span className="mt-0.5 text-[10px] font-bold">{label}</span>
    </Link>
  );
}

function NavBarBackground() {
  return (
    <div
      className="absolute inset-0 flex"
      style={{ filter: 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))' }}
    >
      <div className="h-full flex-1 bg-surface" />
      <svg
        className="block h-full shrink-0 text-surface"
        width="140"
        height="72"
        viewBox="0 0 140 72"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 0 L14 0 C17 0, 19 1, 20 4 C20 28, 42 50, 70 50 C98 50, 120 28, 120 4 C121 1, 123 0, 126 0 L140 0 L140 72 L0 72 Z"
          fill="currentColor"
        />
      </svg>
      <div className="h-full flex-1 bg-surface" />
    </div>
  );
}

export function BottomNav() {
  const location = useLocation();
  const ttsEnabled = useVoiceSettingsStore((s) => s.ttsEnabled);
  const setTtsEnabled = useVoiceSettingsStore((s) => s.setTtsEnabled);
  const micEnabled = useVoiceSettingsStore((s) => s.micEnabled);
  const setMicEnabled = useVoiceSettingsStore((s) => s.setMicEnabled);
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  const isListening = useVoiceStore((s) => s.isListening);
  const currentRms = useAudioMetricsStore((s) => s.currentRms);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname === path;
  };

  const activeRings = isSpeaking ? 'left' : isListening ? 'right' : null;
  const intensity = isListening ? Math.min(currentRms / 0.05, 1) : undefined;

  const handleLeftToggle = () => {
    const next = !ttsEnabled;
    if (!next) stopTTS();
    setTtsEnabled(next);
    track('toggle_ai_voice', { new_state: next ? 'on' : 'off' });
  };

  const handleRightToggle = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    track('toggle_mic', {
      new_state: next ? 'on' : 'off',
      during_conversation: isListening || isSpeaking,
    });
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div>
        <div className="relative" style={{ height: '72px' }}>
          <NavBarBackground />

          <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
            <DualButton
              size={91}
              leftIcon={ttsEnabled ? <IconChatVoice size={24} /> : <IconChatText size={24} />}
              rightIcon={micEnabled ? <IconMic size={24} /> : <IconMicMuted size={24} />}
              leftActive={ttsEnabled}
              rightActive={micEnabled}
              onLeftClick={handleLeftToggle}
              onRightClick={handleRightToggle}
              ariaLabel="Voice controls"
              leftAriaLabel={ttsEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
              rightAriaLabel={micEnabled ? 'Disable microphone' : 'Enable microphone'}
              activeRings={activeRings}
              intensity={intensity}
            />
          </div>

          <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
            <NavTab
              icon="ic:round-home"
              label="Home"
              path="/"
              isActive={isActive('/')}
              destination="home"
            />
            <NavTab
              icon="ic:round-leaderboard"
              label="Progress"
              path="/report"
              isActive={isActive('/report')}
              destination="progress"
            />
            <div />
            <NavTab
              icon="mingcute:stopwatch-fill"
              label="Focus"
              path="/focus"
              isActive={isActive('/focus')}
              destination="focus"
            />
            <NavTab
              icon="ic:round-person"
              label="Profile"
              path="/settings"
              isActive={isActive('/settings')}
              destination="profile"
            />
          </div>
        </div>
        <div className="bg-surface" style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </nav>
  );
}

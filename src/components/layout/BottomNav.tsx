import { Icon } from '@iconify/react';
import { Link, useLocation } from 'react-router-dom';
import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';
import { stopTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';
import { useVoiceStore } from '@/stores/voiceStore';

interface NavTabProps {
  icon: string;
  label: string;
  path: string;
  isActive: boolean;
}

function NavTab({ icon, label, path, isActive }: NavTabProps) {
  return (
    <Link
      to={path}
      className={`flex flex-col items-center justify-end ${isActive ? 'text-primary' : 'text-content-tertiary'}`}
    >
      <Icon icon={icon} width={24} />
      <span className="mt-0.5 text-[10px] font-bold">{label}</span>
    </Link>
  );
}

function NavBarBackground() {
  return (
    <svg
      className="absolute inset-0 h-full w-full text-surface"
      viewBox="0 0 400 80"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0px -4px 12px rgba(0,0,0,0.06))' }}
    >
      <path
        d="
          M0 16 C0 6, 6 0, 16 0
          L140 0
          C146 0, 148 2, 150 8
          A 50 46 0 0 0 250 8
          C252 2, 254 0, 260 0
          L384 0
          C394 0, 400 6, 400 16
          L400 80 L0 80 Z
        "
        fill="currentColor"
      />
    </svg>
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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname === path;
  };

  const activeRings = isSpeaking ? 'left' : isListening ? 'right' : null;

  const handleLeftToggle = () => {
    const next = !ttsEnabled;
    if (!next) stopTTS();
    setTtsEnabled(next);
  };

  const handleRightToggle = () => setMicEnabled(!micEnabled);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
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
            />
          </div>

          <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
            <NavTab icon="ic:round-home" label="Home" path="/" isActive={isActive('/')} />
            <NavTab
              icon="ic:round-leaderboard"
              label="Progress"
              path="/report"
              isActive={isActive('/report')}
            />
            <div />
            <NavTab
              icon="mingcute:stopwatch-fill"
              label="Focus"
              path="/focus"
              isActive={isActive('/focus')}
            />
            <NavTab
              icon="ic:round-person"
              label="Profile"
              path="/settings"
              isActive={isActive('/settings')}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

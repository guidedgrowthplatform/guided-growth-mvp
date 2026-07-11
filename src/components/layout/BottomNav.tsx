import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { track } from '@/analytics';
import { IconChatText, IconMicMuted } from '@/components/icons';
import { Orb, type OrbStateSel } from '@/components/orb/Orb';
import { DEFAULT_PARAMS, DEFAULT_PULSE } from '@/components/orb/orbConfig';
import { deriveOrbRing } from '@/components/ui/orbRing';
import { useCoachChatLauncher } from '@/contexts/CoachChatContext';
import { useToast } from '@/contexts/ToastContext';
import { useCoachVoice } from '@/contexts/useCoachVoiceSession';
import { useDualButtonControls } from '@/hooks/useDualButtonControls';
import { useMicVoiceActivity } from '@/hooks/useMicRingIntensity';
import { useScreenMap } from '@/hooks/useScreenMap';
import { useSessionLog } from '@/hooks/useSessionLog';
import { useVoiceChannelBusy } from '@/hooks/useVoiceChannelBusy';
import { stopTTS, useTtsPlaybackStore } from '@/lib/services/tts-service';
import { useVoiceStore } from '@/stores/voiceStore';

// Soft-keyboard heuristic: visual viewport shrinks by more than this when the
// on-screen keyboard opens. 150px clears address-bar collapse + browser chrome.
const KEYBOARD_OPEN_THRESHOLD_PX = 150;

/**
 * Detects whether the on-screen keyboard is open by watching the Visual
 * Viewport API. Used to hide the bottom nav so it doesn't ride up with the
 * keyboard on iOS Safari / Android Chrome / Capacitor WebViews.
 *
 * Falls back to `false` (nav visible) on platforms without visualViewport
 * support (older WebViews / SSR), which matches today's behaviour.
 */
function useSoftKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const delta = window.innerHeight - vv.height;
      setOpen(delta > KEYBOARD_OPEN_THRESHOLD_PX);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return open;
}

type NavDestination = 'home' | 'progress' | 'reset' | 'profile';

interface NavTabProps {
  icon: string;
  label: string;
  path: string;
  isActive: boolean;
  destination: NavDestination;
  onNavigate?: () => void;
}

function NavTab({ icon, label, path, isActive, destination, onNavigate }: NavTabProps) {
  return (
    <Link
      to={path}
      onClick={() => {
        track('tap_nav_item', { destination });
        onNavigate?.();
      }}
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
  const {
    voiceOn: ttsEnabled,
    micOn: micEnabled,
    micAllowed,
    toggleVoice,
    toggleMic,
    requestMicPermission,
  } = useDualButtonControls();
  const isSpeaking = useTtsPlaybackStore((s) => s.isSpeaking);
  // Listen-state is sourced from the lifted coach session (Soniox streaming)
  // first; legacy voiceStore.isListening (set by record-and-send paths the
  // onboarding flow still uses) is the fallback. OR-combine so the orb lights
  // up whichever surface is active.
  const coachVoice = useCoachVoice();
  const coachListening = (coachVoice?.voiceState ?? 'idle') === 'listening';
  const legacyListening = useVoiceStore((s) => s.isListening);
  const isListening = coachListening || legacyListening;
  const { intensity: micIntensity, speaking: micSpeaking } = useMicVoiceActivity(isListening);
  const channelBusy = useVoiceChannelBusy();
  const { logEvent, startVoice, endVoice } = useSessionLog();
  const { addToast } = useToast();
  const { routeToScreenId } = useScreenMap();
  const voiceAnchorIdRef = useRef<string | null>(null);
  const micRequestPendingRef = useRef<boolean>(false);
  const keyboardOpen = useSoftKeyboardOpen();
  const { openScreenId, closeCoachChat } = useCoachChatLauncher();
  // Tab nav while the coach overlay is open: stop playback + close (mirrors the X button).
  const dismissOverlay =
    openScreenId !== null
      ? () => {
          stopTTS();
          closeCoachChat();
        }
      : undefined;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname === path;
  };

  const activeRings = deriveOrbRing({
    voiceOn: ttsEnabled,
    micOn: micEnabled,
    speaking: isSpeaking,
    listening: isListening,
    micSpeaking,
  });
  const intensity = activeRings === 'right' ? micIntensity : undefined;
  // Map the same voice state to the new orb's look: coach speaking = left ring,
  // user speaking = right ring, everything else = idle two-half orb.
  const orbState: OrbStateSel =
    activeRings === 'left' ? 'coach' : activeRings === 'right' ? 'user' : 'idle';
  // Feed the mic amplitude into the orb's pulse (the same intensity the rings used).
  const orbMic = useRef<{ on: boolean; amp: number }>({ on: false, amp: 0 });
  orbMic.current = { on: activeRings === 'right', amp: intensity ?? 0 };

  const handleLeftToggle = () => {
    const next = !ttsEnabled;
    toggleVoice();
    track('toggle_ai_voice', { new_state: next ? 'on' : 'off' });
    const screenId = routeToScreenId(location.pathname) ?? undefined;
    if (next) {
      voiceAnchorIdRef.current = startVoice(screenId);
    } else if (voiceAnchorIdRef.current) {
      endVoice(voiceAnchorIdRef.current, 'user_exit');
      voiceAnchorIdRef.current = null;
    }
  };

  const handleRightToggle = () => {
    const screenId = routeToScreenId(location.pathname) ?? undefined;
    // Pre-build users default to micPermission=false; prompt instead of no-op.
    if (!micAllowed) {
      if (micRequestPendingRef.current) return;
      micRequestPendingRef.current = true;
      logEvent('mic_tapped', { from_screen: screenId ?? 'UNKNOWN' }, screenId);
      void requestMicPermission()
        .then((granted) => {
          // Returns a STRING — non-empty is always truthy, so guard on the value.
          if (granted !== 'granted') {
            addToast(
              'error',
              granted === 'denied'
                ? 'Microphone access is blocked. Enable it in Settings to talk with your coach.'
                : "Microphone isn't available right now. Try again in a moment.",
            );
            return;
          }
          track('toggle_mic', { new_state: 'on', during_conversation: channelBusy });
        })
        .finally(() => {
          micRequestPendingRef.current = false;
        });
      return;
    }
    const next = !micEnabled;
    toggleMic();
    track('toggle_mic', {
      new_state: next ? 'on' : 'off',
      during_conversation: channelBusy,
    });
    logEvent('mic_tapped', { from_screen: screenId ?? 'UNKNOWN' }, screenId);
  };

  // CSS-hide (not unmount) while the soft keyboard is up — position:fixed
  // anchors to the layout viewport and rides up over content as the visual
  // viewport shrinks (issue #194). Unmounting would orphan in-flight voice
  // anchors held in voiceAnchorIdRef.
  return (
    <nav className={`fixed inset-x-0 bottom-0 z-[60] lg:hidden ${keyboardOpen ? 'hidden' : ''}`}>
      <div>
        <div className="relative" style={{ height: '72px' }}>
          <NavBarBackground />

          <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-1/2">
            {/* The new orb as the visual, with transparent half-buttons on top so the
                tap targets, a11y, and toggle behaviour stay exactly as before. */}
            <div
              className="relative"
              style={{ width: 91, height: 91 }}
              role="group"
              aria-label="Voice controls"
            >
              <Orb
                size={91}
                state={orbState}
                style="full"
                params={DEFAULT_PARAMS}
                pulse={DEFAULT_PULSE}
                leftOn={ttsEnabled}
                rightOn={micEnabled}
                mic={orbMic}
                idleIcons={{
                  leftOn: null,
                  leftOff: <IconChatText size={24} />,
                  rightOn: null,
                  rightOff: <IconMicMuted size={24} />,
                }}
              />
              <button
                type="button"
                onClick={handleLeftToggle}
                aria-label={ttsEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
                aria-pressed={ttsEnabled}
                className="absolute inset-y-0 left-0 z-10 w-[calc(50%-2.5px)] rounded-l-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <button
                type="button"
                onClick={handleRightToggle}
                aria-label={micEnabled ? 'Disable microphone' : 'Enable microphone'}
                aria-pressed={micEnabled}
                className="absolute inset-y-0 right-0 z-10 w-[calc(50%-2.5px)] rounded-r-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>
          </div>

          <div className="relative grid h-full grid-cols-5 items-end px-6 pb-2">
            <NavTab
              icon="ic:round-home"
              label="Home"
              path="/"
              isActive={isActive('/')}
              destination="home"
              onNavigate={dismissOverlay}
            />
            <NavTab
              icon="ic:round-leaderboard"
              label="Progress"
              path="/report"
              isActive={isActive('/report')}
              destination="progress"
              onNavigate={dismissOverlay}
            />
            <div />
            <NavTab
              icon="ph:waves-bold"
              label="Reset"
              path="/reset"
              isActive={isActive('/reset')}
              destination="reset"
              onNavigate={dismissOverlay}
            />
            <NavTab
              icon="ic:round-person"
              label="Profile"
              path="/settings"
              isActive={isActive('/settings')}
              destination="profile"
              onNavigate={dismissOverlay}
            />
          </div>
        </div>
        <div className="bg-surface" style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </nav>
  );
}

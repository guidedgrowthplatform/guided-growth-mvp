import { IconChatText, IconChatVoice, IconMic, IconMicMuted } from '@/components/icons';
import { DualButton } from '@/components/ui/DualButton';

interface OrbControlsProps {
  size: number;
  leftActive: boolean;
  rightActive: boolean;
  activeRings: 'left' | 'right' | 'ready' | 'idle' | null;
  ringCount: number;
  ringStep: number;
  intensity?: number;
  micAllowed: boolean;
  onToggleVoice: () => void;
  onToggleMic: () => void;
  onRequestMic: () => void;
}

export function OrbControls({
  size,
  leftActive,
  rightActive,
  activeRings,
  ringCount,
  ringStep,
  intensity,
  micAllowed,
  onToggleVoice,
  onToggleMic,
  onRequestMic,
}: OrbControlsProps) {
  return (
    <DualButton
      size={size}
      leftActive={leftActive}
      rightActive={rightActive}
      activeRings={activeRings}
      ringCount={ringCount}
      ringStep={ringStep}
      intensity={activeRings === 'right' ? intensity : undefined}
      leftIcon={leftActive ? <IconChatVoice size={28} /> : <IconChatText size={28} />}
      rightIcon={rightActive ? <IconMic size={26} /> : <IconMicMuted size={26} />}
      onLeftClick={onToggleVoice}
      onRightClick={micAllowed ? onToggleMic : onRequestMic}
      leftAriaLabel={leftActive ? 'Switch to screen mode' : 'Switch to voice mode'}
      rightAriaLabel={
        !micAllowed ? 'Allow microphone' : rightActive ? 'Turn mic off' : 'Turn mic on'
      }
    />
  );
}

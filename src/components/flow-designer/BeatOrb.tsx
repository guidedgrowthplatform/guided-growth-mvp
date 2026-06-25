import { OrbControls } from '@/components/voice/OrbControls';

// The ONE shared orb. It renders the real app orb (OrbControls, which drives the
// real DualButton with the real icons and rings), the same component the live
// onboarding screen uses. So a beat's orb is exactly what ships: change the app
// orb and every beat here inherits it, no rebuild.
//
// `state` presets the look. The click handlers are no-ops because the builder
// preview is non-interactive; in the real app the same OrbControls is wired to
// the live voice/mic controls.

export type OrbState = 'idle' | 'talking' | 'listening' | 'mic-request';

const noop = () => {};

// Each state maps to the real OrbControls props. ringCount 3 / ringStep 4 match
// the live onboarding overlay. intensity only animates the right (mic) rings.
const STATES: Record<
  OrbState,
  {
    leftActive: boolean;
    rightActive: boolean;
    activeRings: 'left' | 'right' | 'idle';
    intensity?: number;
    micAllowed: boolean;
  }
> = {
  // Resting: voice mode on, mic off, gentle idle rings. The "going back" look.
  idle: { leftActive: true, rightActive: false, activeRings: 'idle', micAllowed: false },
  // Coach is speaking: the voice (left) side carries the active rings.
  talking: { leftActive: true, rightActive: false, activeRings: 'left', micAllowed: false },
  // User is speaking with the mic on: the mic (right) side pulses with voice.
  listening: { leftActive: true, rightActive: true, activeRings: 'right', intensity: 0.6, micAllowed: true },
  // Asking to turn the mic on: mic still muted, the mic side pulses to invite a tap.
  'mic-request': { leftActive: true, rightActive: false, activeRings: 'right', intensity: 0.5, micAllowed: false },
};

export function BeatOrb({ state = 'idle', size = 91 }: { state?: OrbState; size?: number }) {
  const c = STATES[state];
  return (
    <OrbControls
      size={size}
      leftActive={c.leftActive}
      rightActive={c.rightActive}
      activeRings={c.activeRings}
      ringCount={3}
      ringStep={4}
      intensity={c.intensity}
      micAllowed={c.micAllowed}
      onToggleVoice={noop}
      onToggleMic={noop}
      onRequestMic={noop}
    />
  );
}

// Orb state per beat type across the onboarding flow. mic-permission pulses the
// mic side; coach-led beats show talking; user-action and summary beats rest idle.
const TALKING_BEATS = new Set([
  'splash-intro',
  'profile-beat',
  'path-selection',
  'category-grid',
  'goals-list',
  'habit-picker',
  'reflection-card',
]);

export function orbStateForType(type: string): OrbState {
  if (type === 'mic-permission') return 'mic-request';
  if (TALKING_BEATS.has(type)) return 'talking';
  return 'idle';
}

import { MicPermission } from '@/components/welcome/MicPermission';
import { useIsPlaying, type BeatDef } from '../beatKit';

// Beat 5 IS the locked MicPermission sequence: the orb grows from its dock up to
// the top, the grey mic half pulsing to ask, the Allow button right under it,
// then on allow the mic half turns blue and the orb settles back into its dock.
// The sequence brings its own orb, so the shared canvas orb is hidden on this
// beat (see orbConfigForType in BeatOrb). On the static canvas it loops; in Play
// it plays once and waits for the user to allow.
function MicPermissionBeat(props?: Record<string, string>) {
  const playing = useIsPlaying();
  return (
    <div style={{ position: 'relative', width: '100%', height: 728 }}>
      <MicPermission
        loop={!playing}
        autoPlay
        heading={props?.heading}
        subheading={props?.sub}
      />
    </div>
  );
}

const micPermissionBeat: BeatDef = {
  type: 'mic-permission',
  group: 'Onboarding',
  label: 'Mic permission',
  Comp: MicPermissionBeat,
};

export default micPermissionBeat;

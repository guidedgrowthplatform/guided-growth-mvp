// Visual identity (orb, palette, font) is owned entirely by the SplashIntro
// component. No local style overrides needed here. The shared _beatStyle tokens
// apply inside SplashIntro itself rather than at this wrapper level.
import { SplashIntro } from '@/components/welcome/SplashIntro';
import { useIsPlaying, type BeatDef } from '../beatKit';

// Beat 3 IS the locked SplashIntro coach greeting: the orb blooms up and speaks,
// the voice half breathing with the audio, the voice cone radiating, and the words
// filling into the bubble synced to the clip, then the orb settles into its dock.
// It brings its own orb, so the shared canvas orb is hidden on this beat (see
// orbConfigForType in BeatOrb). In Play it plays the real recording; on the static
// canvas it renders settled and silent. Audio is owned by the shared narration
// driver, so this visual component never starts the MP3 by itself.
function CoachGreetingBeat() {
  const playing = useIsPlaying();
  return (
    <div style={{ position: 'relative', width: '100%', height: 728 }}>
      <SplashIntro
        autoPlay={playing}
        loop={!playing}
        skipSplash
      />
    </div>
  );
}

const coachGreetingBeat: BeatDef = {
  type: 'splash-intro',
  group: 'Onboarding',
  label: 'Coach greeting',
  Comp: CoachGreetingBeat,
};

export default coachGreetingBeat;

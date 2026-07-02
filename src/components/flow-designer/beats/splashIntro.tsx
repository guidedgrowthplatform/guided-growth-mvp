// Visual identity (orb, palette, font) is owned entirely by the SplashIntro
// component. No local style overrides needed here. The shared _beatStyle tokens
// apply inside SplashIntro itself rather than at this wrapper level.
import { SplashIntro } from '@/components/welcome/SplashIntro';
import { useIsPlaying, type BeatDef } from '../beatKit';
import { useHasStarted } from './_startGate';

// Beat 3 IS the locked SplashIntro coach greeting: the orb blooms up and speaks,
// the voice half breathing with the audio, the voice cone radiating, and the words
// filling into the bubble synced to the clip, then the orb settles into its dock.
// It brings its own orb, so the shared canvas orb is hidden on this beat (see
// orbConfigForType in BeatOrb). In Play it plays the real recording; on the static
// canvas it loops without audio (the orb speaks; the words fill once the audio
// runs in Play).
function CoachGreetingBeat() {
  const playing = useIsPlaying();
  const started = useHasStarted();
  // The greeting only goes live (real audio, single play) once Get Started is
  // pressed. Until then it renders as the settled, silent orb, so the page no
  // longer plays the MP3 the moment it loads. Pressing Get Started flips
  // autoPlay false -> true, and SplashIntro's autoplay effect plays the clip
  // from the top as a real user gesture.
  const live = playing && started;
  return (
    <div style={{ position: 'relative', width: '100%', height: 728 }}>
      <SplashIntro
        autoPlay={live}
        loop={!live}
        audioSrc="/voice/splash_welcome.mp3"
        muted={!live}
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

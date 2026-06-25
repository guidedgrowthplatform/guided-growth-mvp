import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

// The coach greeting beat. The static design tile shows the coach speaking the
// greeting ("Hey, I might have startled you...") as a karaoke bubble, with the
// resting canvas orb below. The full SplashIntro bloom is a runtime animation
// (it plays live on the Get Started press, audio-synced); the static canvas shows
// the screen, not the animation. Greeting copy is editable from props.greeting.
function CoachGreetingBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'greet',
      speaker: 'coach',
      say:
        props?.greeting ??
        "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at Guided Growth, and I'm excited to help you improve the things in your life that matter. Let's get you in, and we'll get started.",
    },
  ];
  return <BeatPlayer steps={steps} />;
}

const coachGreetingBeat: BeatDef = {
  type: 'splash-intro',
  group: 'Onboarding',
  label: 'Coach greeting',
  Comp: CoachGreetingBeat,
};

export default coachGreetingBeat;

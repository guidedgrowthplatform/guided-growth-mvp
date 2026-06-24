import { SplashIntro } from '@/components/welcome/SplashIntro';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';

function SplashIntroBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'splash',
      speaker: 'coach',
      say:
        props?.greeting ??
        "Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.",
      render: (
        <SplashIntro
          loop={props?.loop === 'true'}
          autoPlay={props?.autoPlay !== 'false'}
          audioSrc={props?.audioSrc}
        />
      ),
    },
  ];
  return <BeatPlayer steps={steps} />;
}

const splashIntroBeat: BeatDef = {
  type: 'splash-intro',
  group: 'Onboarding',
  label: 'Splash intro',
  Comp: SplashIntroBeat,
};

export default splashIntroBeat;

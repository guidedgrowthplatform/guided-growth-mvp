import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { FONT, SUBTLE, CARD } from './_beatStyle';

// A single read-only dimension tile shown as the coach names it in the why-intro
// beat. Illustration only (non-interactive): it previews the four check-in
// dimensions the user answers a moment later in the state check. Uses the real
// checkInConfig so it looks exactly like the shipped tiles.
function DimensionTile({ dimKey }: { dimKey: string }) {
  const dim = checkInDimensions.find((d) => d.key === dimKey);
  if (!dim) return null;
  return (
    <div
      style={{
        ...CARD,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 14px',
        width: '100%',
        maxWidth: 360,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: SUBTLE,
        }}
      >
        {dim.label}
      </span>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
        {dim.options.map((o) => (
          <EmojiOptionButton
            key={o.value}
            icon={o.icon}
            label={o.label}
            color={o.color}
            isSelected={false}
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

// Beat: Why Intro (Beat 3 of the framing arc).
// One big coach bubble carries the whole framing: the day runs on autopilot, the
// pieces connect, you see your patterns, the answer is in the pattern, and it all
// costs nothing but talking. As it plays, the four state dimensions reveal one at
// a time below it, previewing the check-in that comes next.
//
// AV-sync note: in the shipped build each dimension is its own MP3 clip
// (why_03_sleep .. why_06_stress), so each tile reveals exactly on its word. Here
// in the review render they stagger in via the player, since the clips are not
// recorded yet. The text lives in the one big bubble, the tiles render separately,
// which is the locked design.
function WhyIntroBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'frame',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "We start with the morning check-in. So much of the day runs on autopilot, so this is your moment to stop and notice how you actually are. It's the first habit, everything else builds on it. And pretty quickly, the pieces start to connect. Your sleep, your mood, your energy, your stress, and how they pull on each other. You'll start to see your own patterns. And once you can see the pattern, the answer's usually right there in it. All of that, just by talking to me.",
    },
    { id: 'tile-sleep', speaker: 'coach', render: <DimensionTile dimKey="sleep" /> },
    { id: 'tile-mood', speaker: 'coach', render: <DimensionTile dimKey="mood" /> },
    { id: 'tile-energy', speaker: 'coach', render: <DimensionTile dimKey="energy" /> },
    { id: 'tile-stress', speaker: 'coach', render: <DimensionTile dimKey="stress" /> },
  ];

  return <BeatPlayer steps={steps} />;
}

const whyIntroBeat: BeatDef = {
  type: 'why-intro',
  group: 'Onboarding',
  label: 'Why intro',
  Comp: WhyIntroBeat,
};

export default whyIntroBeat;

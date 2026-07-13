import { useState } from 'react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { Button } from '@/components/ui/Button';
import { BeatPlayer, Bloom, useElementReveal, type BeatDef, type BeatStep } from '../beatKit';
import { FONT, SUBTLE, CARD, SPACE } from './_beatStyle';
import { VoiceOpenHint } from './profile';

// The morning state-check card: all four rows (sleep, mood, energy, stress) in one
// card, the user selects each. This is the real four-row card, not the mood-only row.
// A Done button below the rows lets a mic-off user advance with whatever subset
// they have filled in (no dimension is required before moving on).
export function StateCheckCard({ onDone }: { onDone?: () => void }) {
  const [sel, setSel] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  // Each dimension row blooms as its per-element clip plays (sleep, mood, energy,
  // stress). The Done button and voice hint arrive once all four are shown.
  const reveal = useElementReveal(checkInDimensions.length);
  const hasTapped = Object.keys(sel).length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
        width: '100%',
        maxWidth: 360,
      }}
    >
      {/* Main card with dimensions */}
      <div
        style={{
          ...CARD,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.lg,
          padding: '16px 16px 12px',
        }}
      >
        {checkInDimensions.map((dim, i) => (
          <Bloom key={dim.key} show={i < reveal}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    isSelected={sel[dim.key] === o.value}
                    onClick={() => setSel((p) => ({ ...p, [dim.key]: o.value }))}
                  />
                ))}
              </div>
            </div>
          </Bloom>
        ))}

        {/* Done only appears once the user taps an option. If they don't tap, they
            just talk it, so there is nothing to confirm. */}
        <Bloom show={hasTapped}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={done}
            onClick={() => {
              setDone(true);
              onDone?.();
            }}
          >
            {done ? 'Got it' : 'Done'}
          </Button>
        </Bloom>
      </div>

      {/* The same "you can talk, or tap" reminder from the profile beat, repeated
          once under the state cards. This is still early, so it keeps reminding
          the user they can just speak. It does not carry on to later beats. */}
      <Bloom show={reveal >= checkInDimensions.length}>
        <VoiceOpenHint />
      </Bloom>
    </div>
  );
}

export function StateCheckScreen({
  props,
  onAdvance,
}: {
  props?: Record<string, string>;
  onAdvance?: () => void;
}) {
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Let's do your first check-in right now.",
    },
  ];
  // Optional second coach bubble (the onboarding opener splits its framing in two).
  if (props?.coachLine2) {
    steps.push({ id: 'ask2', speaker: 'coach', say: props.coachLine2 });
  }
  steps.push({ id: 'card', speaker: 'coach', render: <StateCheckCard onDone={onAdvance} /> });
  return <BeatPlayer steps={steps} />;
}

function StateCheckBeat(props?: Record<string, string>) {
  return <StateCheckScreen props={props} />;
}

const stateCheckBeat: BeatDef = {
  type: 'state-check',
  group: 'Check-in',
  label: 'State check (sleep / mood / energy / stress)',
  Comp: StateCheckBeat,
};

export default stateCheckBeat;

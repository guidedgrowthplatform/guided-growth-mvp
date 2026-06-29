import { useState } from 'react';
import { Icon } from '@iconify/react';
import { checkInDimensions } from '@/components/home/checkInConfig';
import { EmojiOptionButton } from '@/components/home/EmojiOptionButton';
import { Button } from '@/components/ui/Button';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { FONT, PRIMARY, INK, SUBTLE, CARD, SPACE } from './_beatStyle';

// Subtle "voice is open" affordance, modeled on the MicHint in categoryGrid.tsx.
// Shown below the state-check card so users know they can speak their state aloud
// instead of (or in addition to) choosing the emoji options.
function MicHint() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 14,
        border: `1.5px solid ${PRIMARY}`,
        background: 'rgba(19,91,235,0.04)',
        boxShadow: '0 2px 10px -6px rgba(19,91,235,0.16)',
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PRIMARY,
        }}
      >
        <Icon icon="mdi:microphone" width={15} height={15} style={{ color: '#fff' }} />
      </div>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 600,
          color: INK,
          lineHeight: 1.35,
        }}
      >
        Voice is open, say how you are landing
      </span>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          background: PRIMARY,
          animation: 'ggMicPulse 2s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes ggMicPulse{0%,100%{opacity:.22}50%{opacity:.85}}`}</style>
    </div>
  );
}

// The morning state-check card: all four rows (sleep, mood, energy, stress) in one
// card, the user selects each. This is the real four-row card, not the mood-only row.
// A Done button below the rows lets a mic-off user advance with whatever subset
// they have filled in (no dimension is required before moving on).
function StateCheckCard() {
  const [sel, setSel] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, width: '100%', maxWidth: 360 }}>
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
        {checkInDimensions.map((dim) => (
          <div key={dim.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        ))}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={done}
          onClick={() => setDone(true)}
        >
          {done ? 'Got it' : 'Done'}
        </Button>
      </div>

      {/* Voice hint below the card */}
      <MicHint />
    </div>
  );
}

function StateCheckBeat(props?: Record<string, string>) {
  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say:
        props?.coachLine ??
        "Let's do your first check-in right now. How are you landing in this moment? Mood, energy, sleep, anything on you.",
    },
    { id: 'card', speaker: 'coach', render: <StateCheckCard /> },
  ];
  return <BeatPlayer steps={steps} />;
}

const stateCheckBeat: BeatDef = {
  type: 'state-check',
  group: 'Check-in',
  label: 'State check (sleep / mood / energy / stress)',
  Comp: StateCheckBeat,
};

export default stateCheckBeat;

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';

const FONT = 'Urbanist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const BLUE = 'rgb(19, 91, 235)';

const CATS = [
  { label: 'Sleep better', image: '/images/onboarding/sleep-better.png' },
  { label: 'Move more', image: '/images/onboarding/move-more.jpg' },
  { label: 'Eat better', image: '/images/onboarding/eat-better.png' },
  { label: 'Feel more energized', image: '/images/onboarding/feel-more-energized.png' },
  { label: 'Reduce stress', image: '/images/onboarding/reduce-stress.png' },
  { label: 'Improve focus', image: '/images/onboarding/improve-focus.jpg' },
  { label: 'Break bad habits', image: '/images/onboarding/break-bad-habits.png' },
  { label: 'Get more organized', image: '/images/onboarding/get-more-organized.png' },
];

// A passive mic affordance: signals that the coach is listening so the user can
// talk it through verbally before or while choosing a category card. Intentionally
// quiet, not a full scanner, because this is an invitation, not a capture surface.
function MicHint({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 16,
        border: `1.5px solid ${BLUE}`,
        background: 'rgba(19,91,235,0.05)',
        boxShadow: '0 4px 14px -8px rgba(19,91,235,0.18)',
      }}
    >
      {/* Mic icon tile, matches the listening-surface style in advancedCapture. */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BLUE,
        }}
      >
        <Icon icon="mdi:microphone" width={18} height={18} style={{ color: '#fff' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13.5,
            fontWeight: 600,
            color: 'rgb(15,23,42)',
            lineHeight: 1.35,
          }}
        >
          {label}
        </div>
      </div>

      {/* Breathing pulse dot to show the channel is open, not recording. */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          background: BLUE,
          animation: 'ggMicPulse 2s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes ggMicPulse{0%,100%{opacity:.25}50%{opacity:.9}}`}</style>
    </div>
  );
}

function CategoryGrid(props?: Record<string, string>) {
  // In Play the pick writes to shared flow state so the goals beat reads it; on
  // the static canvas there is no provider, so fall back to local state.
  const flow = useFlowState();
  const [localSel, setLocalSel] = useState<string | null>('Sleep better');
  const sel = flow ? flow.category : localSel;
  const pick = (label: string) => (flow ? flow.setCategory(label) : setLocalSel(label));

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      // Real copy comes from beatContexts.ts. Placeholder matches the v3 mock
      // (beat 11a): no tap/click language, just an open invitation.
      say: props?.coachLine ?? 'What do you want to grow? Not sure? Talk it through with me.',
    },
    {
      id: 'mic',
      speaker: 'coach',
      // The mic hint renders as a render-only step so it fades in right after the
      // coach line. The say string here becomes a second coach bubble that pairs
      // with the visual: it carries the voice-open invitation. Real copy in
      // beatContexts.ts. No tap/click/press language.
      say:
        props?.micHint ??
        "I'm listening. Go ahead and say what's on your mind, or choose one of the areas below.",
      render: (
        <MicHint
          label={
            props?.micHintLabel ?? 'Voice is open. Say what you want to work on, or pick a card.'
          }
        />
      ),
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="grid grid-cols-2 gap-3">
          {CATS.map((c) => (
            <CategoryCard
              key={c.label}
              image={c.image}
              label={c.label}
              selected={sel === c.label}
              onSelect={() => pick(c.label)}
            />
          ))}
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const categoryGridBeat: BeatDef = {
  type: 'category-grid',
  group: 'Onboarding',
  label: 'Category tiles',
  Comp: CategoryGrid,
};

export default categoryGridBeat;

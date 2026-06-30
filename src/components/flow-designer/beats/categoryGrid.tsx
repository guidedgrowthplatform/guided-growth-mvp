import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { FONT, PRIMARY, INK, SPACE } from './_beatStyle';

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
        gap: SPACE.md,
        padding: `${SPACE.md}px ${SPACE.lg}px`,
        borderRadius: 16,
        border: `1.5px solid ${PRIMARY}`,
        background: 'rgba(19,91,235,0.05)',
        boxShadow: '0 4px 14px -8px rgba(19,91,235,0.18)',
      }}
    >
      {/* Mic icon tile, matches the listening-surface style in advancedCapture. */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PRIMARY,
        }}
      >
        <Icon icon="mdi:microphone" width={19} height={19} style={{ color: '#fff' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 13.5,
            fontWeight: 600,
            color: INK,
            lineHeight: 1.4,
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
          background: PRIMARY,
          animation: 'ggMicPulse 2s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes ggMicPulse{0%,100%{opacity:.25}50%{opacity:.9}}`}</style>
    </div>
  );
}

// Grid + "Create your own" tile, modeled on HabitPickerPanel's custom-habit pattern.
// The tile appears after the eight preset cards. Selecting a custom category
// writes it into flow state exactly as a preset would, so downstream beats
// (e.g. the goals beat) read it without any special-casing.
function CategoryGridPicker({
  sel,
  pick,
}: {
  sel: string | null;
  pick: (label: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showInput, setShowInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Focus the text field as soon as it appears, matching HabitPickerPanel behavior.
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  function handleCreateClick() {
    setShowInput(true);
  }

  function handleSubmitCustom() {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    pick(trimmed);
    setCustomValue('');
    setShowInput(false);
  }

  // A custom category is "selected" when it is the current selection AND it is
  // not one of the preset labels, meaning the user previously submitted one.
  const customIsSelected =
    !!sel && !CATS.some((c) => c.label === sel);

  return (
    <div className="flex flex-col gap-3">
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

      {/* "Create your own" entry point, styled to match HabitPickerPanel. */}
      {showInput ? (
        <div className="flex items-center gap-2 rounded-[24px] border border-primary bg-surface px-[16px] py-[10px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
          <input
            ref={inputRef}
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitCustom()}
            placeholder="Type your own area..."
            className="flex-1 text-[16px] font-bold leading-[24px] text-content outline-none placeholder:font-normal placeholder:text-content-secondary/50"
          />
          <button
            type="button"
            onClick={handleSubmitCustom}
            disabled={!customValue.trim()}
            className="flex size-[28px] shrink-0 items-center justify-center rounded-md bg-success transition-opacity disabled:opacity-30"
          >
            <Icon icon="mdi:check" width={18} height={18} className="text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCreateClick}
          className={`flex w-full items-center justify-between rounded-[24px] border bg-surface px-[16px] py-[14px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)] transition-all duration-200 cursor-pointer ${
            customIsSelected ? 'border-primary' : 'border-border'
          }`}
        >
          <span className="text-[16px] font-bold leading-[24px] text-content">
            {customIsSelected ? sel : 'Create your own'}
          </span>
          <div className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-warning">
            <Icon icon="mdi:plus" width={18} height={18} className="text-white" />
          </div>
        </button>
      )}
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
      say:
        props?.coachLine ??
        'What part of your life do you most want to work on right now? Pick the one that pulls you.',
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
        "I'm here. Share what's on your mind, or choose one of the areas below.",
      render: (
        <MicHint
          label={
            props?.micHintLabel ?? 'Voice is open. Share what you want to work on, or pick a card.'
          }
        />
      ),
    },
    {
      id: 'show',
      speaker: 'coach',
      render: <CategoryGridPicker sel={sel} pick={pick} />,
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

import { Icon } from '@iconify/react';
import { useState, useRef, useEffect } from 'react';
import { CategoryCard } from '@/components/onboarding/CategoryCard';
import { BeatPlayer, Bloom, useElementReveal, type BeatDef, type BeatStep } from '../beatKit';
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
// The women's variant swaps each tile for its female counterpart under
// /images/onboarding/female/. The female art is .webp (from the app's real
// assets), so we swap both the folder and the extension by base name.
function catImage(image: string, variant: 'default' | 'female'): string {
  if (variant !== 'female') return image;
  const name = image.match(/\/([^/]+)\.[a-z0-9]+$/i)?.[1] ?? '';
  return `/images/onboarding/female/${name}.webp`;
}

function CategoryGridPicker({
  sel,
  pick,
  variant = 'default',
}: {
  sel: string | null;
  pick: (label: string) => void;
  variant?: 'default' | 'female';
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
  const customIsSelected = !!sel && !CATS.some((c) => c.label === sel);

  // One extra reveal step past the eight tiles: the "Create your own" tile blooms
  // last, paired with the verbal "Or you can create your own" line in Play.
  const reveal = useElementReveal(CATS.length + 1);
  const showCreateOwn = reveal > CATS.length;

  return (
    <div className="flex flex-col gap-3">
      {/* The men's/women's split is metadata (the variant), not shown in-app. */}
      <div className="grid grid-cols-2 gap-3">
        {CATS.map((c, i) => (
          <Bloom key={c.label} show={i < reveal}>
            <CategoryCard
              image={catImage(c.image, variant)}
              label={c.label}
              selected={sel === c.label}
              onSelect={() => pick(c.label)}
            />
          </Bloom>
        ))}
      </div>

      {/* "Create your own" entry point, styled to match HabitPickerPanel. Blooms
          after the eight preset tiles, carrying the verbal "or you can create
          your own" line. */}
      <Bloom show={showCreateOwn}>
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
            className={`flex w-full cursor-pointer items-center justify-between rounded-[24px] border bg-surface px-[16px] py-[14px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)] transition-all duration-200 ${
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
      </Bloom>
    </div>
  );
}

type CategoryGridProps = {
  coachLine?: string;
  micHintLabel?: string;
  variant?: string;
  hideOrb?: boolean;
  onAdvance?: () => void;
};

export function CategoryGrid(props?: CategoryGridProps) {
  // In Play the pick writes to shared flow state so the goals beat reads it; on
  // the static canvas there is no provider, so fall back to local state.
  const flow = useFlowState();
  // glob-no-preselection: nothing selected on entry
  const [localSel, setLocalSel] = useState<string | null>(null);
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
        "Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.",
    },
    {
      id: 'mic',
      speaker: 'coach',
      // Render-only: just the "voice is open" pill, no second coach bubble. The
      // opener already frames the ask, so the pill alone carries the voice-open
      // invitation without a redundant bubble. No tap/click/press language.
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
      render: (
        <CategoryGridPicker
          sel={sel}
          pick={pick}
          variant={props?.variant === 'female' ? 'female' : 'default'}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <BeatPlayer steps={steps} />
      {props?.onAdvance && (
        <button
          type="button"
          onClick={props.onAdvance}
          disabled={!sel}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-[16px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      )}
    </div>
  );
}

const categoryGridBeat: BeatDef = {
  type: 'category-grid',
  group: 'Onboarding',
  label: 'Category tiles',
  Comp: CategoryGrid,
};

export default categoryGridBeat;

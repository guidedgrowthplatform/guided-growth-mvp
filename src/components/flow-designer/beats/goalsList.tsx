import { useRef, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { BeatPlayer, type BeatDef, type BeatStep } from '../beatKit';
import { useFlowState } from '../flowStateCtx';
import { goalsByCategory } from '@/data/onboardingHabits';
import { SECTION_LABEL, SPACE } from './_beatStyle';

// The user picks 1 or 2 subcategories within their chosen category. The
// underlying flow state field is still named "goals" (a shared-package type),
// but the UX language is "subcategory" throughout, per the v3 spec.
const MAX_SUBCATEGORIES = 2;

function GoalsListBeat(props?: Record<string, string>) {
  // Subcategory list is driven by the category picked upstream. In Play that
  // comes from shared flow state; on the canvas it defaults to "Sleep better"
  // so the tile still shows real options.
  const flow = useFlowState();
  const category = flow?.category ?? 'Sleep better';
  const subcategories = goalsByCategory[category] ?? goalsByCategory['Sleep better'] ?? [];
  const [localSel, setLocalSel] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  const selected = flow ? flow.goals : localSel;
  const maxReached = selected.length >= MAX_SUBCATEGORIES;

  const toggle = (sub: string) =>
    flow
      ? flow.toggleGoal(sub, MAX_SUBCATEGORIES)
      : setLocalSel((prev) =>
          prev.includes(sub)
            ? prev.filter((x) => x !== sub)
            : prev.length < MAX_SUBCATEGORIES
              ? [...prev, sub]
              : prev,
        );

  function handleCreateClick() {
    if (maxReached) return;
    setShowCustomInput(true);
  }

  function handleSubmitCustom() {
    const trimmed = customValue.trim();
    if (!trimmed) return;
    // Skip if it duplicates an existing option (case-insensitive).
    const allOptions = [...subcategories, ...selected];
    if (allOptions.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    toggle(trimmed);
    setCustomValue('');
    setShowCustomInput(false);
  }

  const steps: BeatStep[] = [
    {
      id: 'ask',
      speaker: 'coach',
      say: props?.coachLine ?? "Within that, what's the piece you want to start with?",
    },
    {
      id: 'show',
      speaker: 'coach',
      render: (
        <div className="flex flex-col" style={{ gap: SPACE.md }}>
          <p style={{ ...SECTION_LABEL, marginBottom: SPACE.xs }}>
            Subcategory
          </p>
          {subcategories.map((sub) => {
            const on = selected.includes(sub);
            return (
              <GoalCard
                key={sub}
                label={sub}
                selected={on}
                disabled={!on && maxReached}
                onToggle={() => toggle(sub)}
              />
            );
          })}

          {showCustomInput ? (
            <div className="flex items-center gap-2 rounded-[24px] border border-primary bg-surface px-[16px] py-[10px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)]">
              <input
                ref={inputRef}
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitCustom()}
                placeholder="Type your subcategory..."
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
              className={`flex w-full items-center justify-between rounded-[24px] border bg-surface px-[16px] py-[14px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.04)] transition-all duration-200 ${
                maxReached ? 'border-transparent opacity-40' : 'cursor-pointer border-border'
              }`}
            >
              <span className="text-[16px] font-bold leading-[24px] text-content">
                Create your own
              </span>
              <div className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-warning">
                <Icon icon="mdi:plus" width={18} height={18} className="text-white" />
              </div>
            </button>
          )}
        </div>
      ),
    },
  ];

  return <BeatPlayer steps={steps} />;
}

const goalsListBeat: BeatDef = {
  type: 'goals-list',
  group: 'Onboarding',
  label: 'Subcategory picker',
  Comp: GoalsListBeat,
};

export default goalsListBeat;

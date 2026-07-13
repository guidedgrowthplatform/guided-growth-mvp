import { useMemo, useState } from 'react';
import { IsolatedBeat } from '@/components/flow-designer/FlowDesigner';
import { onboardingContract, type OnboardingBeat } from '@/generated/onboardingContract';

type ContractProps = Record<string, string>;
type ScriptLine = {
  seq: number;
  words: string;
  bindsTo?: { kind: 'bubble' | 'component'; element: string };
};

const previewBeats = onboardingContract.beats;

function scriptFor(beat: OnboardingBeat): readonly ScriptLine[] {
  return beat.script as readonly ScriptLine[];
}

function stringProps(beat: OnboardingBeat): ContractProps {
  const props: ContractProps = {};
  const contractProps = beat.component.props as Record<string, unknown> | null;

  for (const [key, value] of Object.entries(contractProps ?? {})) {
    if (typeof value === 'string') props[key] = value;
  }

  const lines = scriptFor(beat).filter((line) => line.words.trim());
  const opener =
    beat.opener ??
    lines.find(
      (line) => line.bindsTo?.element === 'opener' || line.bindsTo?.element === 'opener-line',
    )?.words ??
    lines.find((line) => line.bindsTo?.kind === 'bubble')?.words;

  if (opener) props.coachLine ??= opener;

  const bubbleLines = lines.filter((line) => line.bindsTo?.kind === 'bubble');
  if (bubbleLines[1]?.words) props.coachLine2 ??= bubbleLines[1].words;

  if (beat.component.key === 'profile-beat') {
    if (opener) props.greeting = opener;
    const ageLine = lines.find((line) => line.bindsTo?.element === 'age')?.words;
    const genderLine = lines.find((line) => line.bindsTo?.element === 'gender')?.words;
    if (ageLine) props.askAge = ageLine;
    if (genderLine) props.askGender = genderLine;
  }

  return props;
}

function beatIndex(id: string): number {
  return previewBeats.findIndex((beat) => beat.id === id);
}

export function ContractOnboardingPreview() {
  const [index, setIndex] = useState(0);
  const beat = previewBeats[index];
  const props = useMemo(() => stringProps(beat), [beat]);
  const isFork = beat.id === 'fork';
  const hasPrevious = index > 0;
  const hasNext = index < previewBeats.length - 1;

  const goTo = (id: string) => {
    const nextIndex = beatIndex(id);
    if (nextIndex >= 0) setIndex(nextIndex);
  };

  return (
    <main className="min-h-dvh bg-surface text-content">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4 px-4 py-5 pb-10">
        <header className="flex items-center justify-between gap-3 text-xs font-semibold text-content-tertiary">
          <span data-testid="current-beat">
            {index + 1} / {previewBeats.length} · {beat.id}
          </span>
          <label className="sr-only" htmlFor="preview-beat-picker">
            Preview beat
          </label>
          <select
            id="preview-beat-picker"
            aria-label="Preview beat"
            value={beat.id}
            onChange={(event) => goTo(event.target.value)}
            className="max-w-[210px] rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-content"
          >
            {previewBeats.map((option) => (
              <option key={option.id} value={option.id}>
                {option.order + 1}. {option.id}
              </option>
            ))}
          </select>
        </header>

        <section
          aria-label={`${beat.id} onboarding screen`}
          data-testid={`real-onboarding-${beat.component.key}`}
          className="min-h-[660px] overflow-hidden rounded-[28px] border border-border-light bg-surface shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
        >
          <IsolatedBeat key={beat.id} type={beat.component.key} props={props} />
        </section>

        <nav aria-label="Preview navigation" className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={!hasPrevious}
            className="h-12 rounded-full border border-primary bg-surface text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            data-testid="continue-preview"
            onClick={() => setIndex((current) => Math.min(previewBeats.length - 1, current + 1))}
            disabled={!hasNext}
            className="h-12 rounded-full bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next beat
          </button>
        </nav>

        {isFork && (
          <div className="grid grid-cols-2 gap-3" aria-label="Choose onboarding path">
            <button
              type="button"
              data-testid="choose-beginner"
              onClick={() => goTo('category')}
              className="min-h-12 rounded-full bg-primary px-4 text-sm font-bold text-white"
            >
              Beginner path
            </button>
            <button
              type="button"
              data-testid="choose-advanced"
              onClick={() => goTo('advanced-capture')}
              className="min-h-12 rounded-full border border-primary bg-surface px-4 text-sm font-bold text-primary"
            >
              Advanced path
            </button>
          </div>
        )}

        <footer className="text-center text-[11px] leading-4 text-content-tertiary">
          Contract v{onboardingContract.schemaVersion} ·{' '}
          {onboardingContract.provenance.artifactHash}
        </footer>
      </div>
    </main>
  );
}

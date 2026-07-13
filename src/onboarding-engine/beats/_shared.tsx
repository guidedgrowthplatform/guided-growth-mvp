import type { ReactNode } from 'react';
import type { OnboardingBeat } from '@/generated/onboardingContract';

export type PreviewSurfaceProps = { beat: OnboardingBeat; children: ReactNode };
export type ScriptLine = { seq: number; words: string; clipPath: string | null };

export const DEFAULT_SCHEDULE_HABITS = ['Morning walk', 'Read 10 pages', 'No screens after 10'];

export function scriptFor(beat: OnboardingBeat): readonly ScriptLine[] {
  return beat.script as readonly ScriptLine[];
}

export function declaredClip(beat: OnboardingBeat): string | null {
  return (
    beat.assets.clips[0]?.clipPath ??
    scriptFor(beat).find((line) => line.clipPath)?.clipPath ??
    null
  );
}

export function Surface({ beat, children }: PreviewSurfaceProps) {
  return (
    <section
      data-testid={`preview-component-${beat.component.key}`}
      style={{
        minHeight: 390,
        borderRadius: 28,
        background: 'linear-gradient(145deg, #102337 0%, #1E4663 48%, #214C5F 100%)',
        padding: 24,
        color: '#F8FBFF',
        boxShadow: '0 24px 64px rgba(15, 38, 58, 0.28)',
      }}
    >
      <div style={{ color: '#9CD9D0', fontSize: 12, fontWeight: 800, letterSpacing: '0.11em' }}>
        {beat.component.key.toUpperCase()}
      </div>
      {children}
    </section>
  );
}

function GenericOrb() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 116,
        height: 116,
        margin: '58px auto 30px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 32% 28%, #E8FFF8, #81D9CE 31%, #3B8BA0 68%, #152F4A)',
        boxShadow: '0 0 0 16px rgba(157, 231, 216, 0.07), 0 16px 46px rgba(0,0,0,.35)',
      }}
    />
  );
}

function GenericSurface({ beat }: { beat: OnboardingBeat }) {
  const opener = beat.opener ?? scriptFor(beat).find((line) => line.words.trim())?.words;
  const elements = beat.component.elements;
  return (
    <Surface beat={beat}>
      <GenericOrb />
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Guided Growth</h1>
      <p style={{ margin: '14px 0 28px', fontSize: 17, lineHeight: 1.5, color: '#D7E5EE' }}>
        {opener || 'This component is present in the onboarding contract.'}
      </p>
      {elements.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {elements.map((element) => (
            <label key={element} style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
              {element}
              <input
                aria-label={element}
                placeholder={`Preview ${element}`}
                style={{ borderRadius: 12, border: 0, padding: '12px 14px', fontSize: 16 }}
              />
            </label>
          ))}
        </div>
      )}
    </Surface>
  );
}

export default GenericSurface;

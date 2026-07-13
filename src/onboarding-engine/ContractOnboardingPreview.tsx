import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GetStarted } from '@/components/flow-designer/beats/getStarted';
import { Orb as RealOrb } from '@/components/orb/Orb';
import { orbIdle } from '@/components/orb/orbView';
import {
  onboardingBeatById,
  onboardingContract,
  type OnboardingBeat,
} from '@/generated/onboardingContract';

const PREVIEW_SPINE = [...onboardingContract.beats]
  .sort((left, right) => left.order - right.order)
  .filter((beat) => beat.variantOf === null && (beat.path === 'both' || beat.path === 'beginner'))
  .map((beat) => beat.id);

type PreviewSurfaceProps = { beat: OnboardingBeat; children: ReactNode };
type ScriptLine = { seq: number; words: string; clipPath: string | null };

function scriptFor(beat: OnboardingBeat): readonly ScriptLine[] {
  return beat.script as readonly ScriptLine[];
}

function Surface({ beat, children }: PreviewSurfaceProps) {
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

function Orb() {
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
      <Orb />
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

function GetStartedPreview({ beat, onAdvance }: { beat: OnboardingBeat; onAdvance: () => void }) {
  return (
    <Surface beat={beat}>
      <div data-testid="get-started-preview">
        {!beat.component.config.hideOrb && (
          <RealOrb {...orbIdle(116, true, true, { frozen: true })} />
        )}
        <GetStarted props={beat.component.props ?? undefined} onAdvance={onAdvance} />
      </div>
    </Surface>
  );
}

type PreviewComponent = (props: { beat: OnboardingBeat; onAdvance: () => void }) => JSX.Element;

const componentRegistry: Record<string, PreviewComponent> = {
  splash: GenericSurface,
  'get-started': GetStartedPreview,
  'splash-intro': GenericSurface,
  'auth-signup': GenericSurface,
  'mic-permission': GenericSurface,
  'profile-beat': GenericSurface,
  'state-check': GenericSurface,
  'morning-checkin-setup': GenericSurface,
  'reflection-card': GenericSurface,
  'path-selection': GenericSurface,
};

function declaredClip(beat: OnboardingBeat): string | null {
  return (
    beat.assets.clips[0]?.clipPath ??
    scriptFor(beat).find((line) => line.clipPath)?.clipPath ??
    null
  );
}

export function ContractOnboardingPreview() {
  const [index, setIndex] = useState(0);
  const [path, setPath] = useState<'beginner' | 'advanced' | null>(null);
  const beatId = PREVIEW_SPINE[index];
  const beat = onboardingBeatById[beatId];
  const SurfaceComponent = componentRegistry[beat.component.key];
  const clipPath = declaredClip(beat);
  const isFork = beat.id === 'fork';
  const canContinue = !isFork && index < PREVIEW_SPINE.length - 1;
  const onAdvance = () => setIndex((current) => Math.min(current + 1, PREVIEW_SPINE.length - 1));
  const progress = `${index + 1} of ${PREVIEW_SPINE.length}`;
  const provenance = onboardingContract.provenance;
  const lines = useMemo(() => scriptFor(beat).filter((line) => line.words.trim()), [beat]);

  useEffect(() => {
    setPath(null);
  }, [beat.id]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#EAF0F3',
        color: '#132B3B',
        fontFamily: 'Urbanist, ui-sans-serif, system-ui, sans-serif',
        padding: '24px 16px 48px',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <header style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#4D7782', letterSpacing: '.08em' }}>
            CONTRACT-BACKED PREVIEW
          </div>
          <h1 style={{ margin: '5px 0', fontSize: 28 }}>Onboarding flow</h1>
          <p data-testid="current-beat" style={{ margin: 0, color: '#48606E', lineHeight: 1.45 }}>
            {progress} · {beat.id}
          </p>
        </header>

        {SurfaceComponent ? (
          <SurfaceComponent beat={beat} onAdvance={onAdvance} />
        ) : (
          <div role="alert">No preview component is registered for {beat.component.key}.</div>
        )}

        {lines.length > 0 && (
          <section aria-label="Coach script" style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            {lines.map((line) => (
              <p
                key={line.seq}
                style={{
                  margin: 0,
                  borderRadius: 16,
                  padding: '12px 14px',
                  background: '#FFFFFF',
                  lineHeight: 1.45,
                }}
              >
                {line.words}
              </p>
            ))}
          </section>
        )}

        {clipPath && (
          <section style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#4D7782', marginBottom: 6 }}>
              DECLARED CLIP
            </div>
            <audio
              data-testid="declared-clip"
              controls
              preload="metadata"
              src={clipPath}
              style={{ width: '100%' }}
            />
          </section>
        )}

        <section style={{ marginTop: 20, display: 'grid', gap: 10 }}>
          {isFork ? (
            <>
              <button
                type="button"
                data-testid="choose-beginner"
                onClick={() => setPath('beginner')}
                style={primaryButton}
              >
                I am new to habits
              </button>
              <button
                type="button"
                data-testid="choose-advanced"
                onClick={() => setPath('advanced')}
                style={secondaryButton}
              >
                I already track habits
              </button>
              {path && (
                <p
                  data-testid="branch-choice"
                  style={{ margin: 0, color: '#315C4D', fontWeight: 700 }}
                >
                  Preview branch selected: {path}. The production transition waits for structured
                  contract branches.
                </p>
              )}
            </>
          ) : (
            <button
              type="button"
              data-testid="continue-preview"
              disabled={!canContinue}
              onClick={onAdvance}
              style={{ ...primaryButton, opacity: canContinue ? 1 : 0.45 }}
            >
              {beat.id === 'sign-up'
                ? 'Continue without signing in'
                : beat.id === 'mic-permission'
                  ? 'Continue without granting mic access'
                  : 'Continue preview'}
            </button>
          )}
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((current) => Math.max(current - 1, 0))}
              style={secondaryButton}
            >
              Back
            </button>
          )}
        </section>

        <footer
          data-testid="contract-provenance"
          style={{
            marginTop: 24,
            borderTop: '1px solid #C8D7DC',
            paddingTop: 14,
            color: '#48606E',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Schema v{onboardingContract.schemaVersion} · artifact {provenance.artifactHash} · source{' '}
          {provenance.sourceCommit}
        </footer>
      </div>
    </main>
  );
}

const primaryButton = {
  width: '100%',
  border: 0,
  borderRadius: 14,
  padding: '14px 16px',
  background: '#177E71',
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
} as const;

const secondaryButton = {
  ...primaryButton,
  background: '#FFFFFF',
  color: '#174755',
  border: '1px solid #A7C1C9',
} as const;

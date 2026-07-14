import { useEffect, useMemo, useState } from 'react';
import { onboardingBeatById, onboardingContract } from '@/generated/onboardingContract';
import { componentRegistry } from './beatRegistry';
import GenericSurface, { declaredClip, scriptFor } from './beats/_shared';

const PREVIEW_SPINE = [...onboardingContract.beats]
  .sort((left, right) => left.order - right.order)
  .filter((beat) => beat.variantOf === null && (beat.path === 'both' || beat.path === 'beginner'))
  .map((beat) => beat.id);

export function ContractOnboardingPreview() {
  // Preview-only deep link: /onboarding/flow-preview?beat=<componentKey> starts on the first beat
  // with that component key. Lets the headless render gate jump directly to a beat instead of
  // walking through interactive gates (mic permission, the profile form, the fork). No effect
  // on the normal flow, which starts at index 0.
  const startIndex = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const wantKey = new URLSearchParams(window.location.search).get('beat');
    if (!wantKey) return 0;
    const found = PREVIEW_SPINE.findIndex(
      (id) => onboardingBeatById[id]?.component.key === wantKey,
    );
    return found >= 0 ? found : 0;
  }, []);
  const [index, setIndex] = useState(startIndex);
  const [path, setPath] = useState<'beginner' | 'advanced' | null>(null);
  const beatId = PREVIEW_SPINE[index];
  const beat = onboardingBeatById[beatId];
  const SurfaceComponent = componentRegistry[beat.component.key] ?? GenericSurface;
  const clipPath = declaredClip(beat);
  const isFork = beat.id === 'fork';
  const canContinue = !isFork && index < PREVIEW_SPINE.length - 1;
  const progress = `${index + 1} of ${PREVIEW_SPINE.length}`;
  const provenance = onboardingContract.provenance;
  const lines = useMemo(() => scriptFor(beat).filter((line) => line.words.trim()), [beat]);
  const onAdvance = () => setIndex((current) => Math.min(current + 1, PREVIEW_SPINE.length - 1));

  // Preview-safe tool stubs (ledger 43): the real app fires submit_* through the tool-calling
  // runtime, which the backend-free preview does not have. These record the call so a submit-
  // requiring beat can perform submit_<x> then advance, without a backend.
  const tools = useMemo(
    () =>
      new Proxy({} as Record<string, (...args: unknown[]) => void>, {
        get:
          (_target, prop) =>
          (...args: unknown[]) => {
            if (typeof window !== 'undefined') {
              const w = window as unknown as {
                __previewSubmits?: Array<{ tool: string; args: unknown[] }>;
              };
              (w.__previewSubmits ||= []).push({ tool: String(prop), args });
            }
          },
      }),
    [],
  );

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

        <SurfaceComponent beat={beat} onAdvance={onAdvance} tools={tools} />

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

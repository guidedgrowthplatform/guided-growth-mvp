/**
 * IntroGate — two-phase gate before the chat begins:
 *
 * Phase 1 (Get Started): shows the brand screen (heading + eyebrow + primary
 * button + login link). Pressing "Get started" is the browser gesture that
 * satisfies the autoplay policy, and the click handler itself starts the
 * coach MP3 (startOpenerFromGesture), synchronously in that gesture frame, so
 * playback is deterministic and the unlock covers every later beat's audio.
 *
 * Phase 2 (Coach greeting): renders SplashIntro with autoPlay + skipSplash and
 * hands it the already-playing clip (adoptedOpener). SplashIntro adopts that
 * element for the orb/captions instead of arming a second play(), so the clip
 * is never double-started and never falls into the deferred-to-tap fallback.
 *
 * After SplashIntro fires onComplete the seen-flag is set and children (the
 * chat) are revealed. First-visit only: a returning/mid-flow user resumes
 * straight into chat, and the flag survives refresh so the intro never replays.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { SplashIntro } from '@/components/welcome/SplashIntro';
import { useOnboarding } from '@/hooks/useOnboarding';
import {
  blessOpenerClipsInGesture,
  startOpenerFromGesture,
  type GestureStartedOpener,
} from './renderer/openerGestureStart';
import { preloadOpenerClips } from './renderer/openerPreloadPool';
import { ONBOARDING_BEAT_MP3S } from './renderer/useBeatOpenerMp3';

const INTRO_SEEN_KEY = 'gg_onboarding_intro_seen';
const INTRO_AUDIO_SRC = '/voice/splash_welcome.mp3';

// Urbanist matches the engine's font stack (same as the flow-builder's FONT token).
const FONT = "Urbanist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = 'rgb(19,91,235)';
const PRIMARY_70 = 'rgba(19,91,235,0.7)';
const SUBTLE = 'rgb(100,116,139)';

function readSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

type Phase = 'get-started' | 'coach-greeting';

export function IntroGate({ children }: { children: React.ReactNode }) {
  const { state } = useOnboarding();
  // current_step >= 1 means past the auth beat — resume into chat, no intro.
  //
  // B43: snapshot this ONCE at mount (lazy useState init), not as a value
  // re-derived every render. FlowOnboarding seeds saveStep(1, { nickname })
  // on its own mount whenever a nickname is already known (every QA/signed-in
  // account, per QAControlScreen) -- that write lands in the SAME
  // onboarding.state query-cache entry this hook subscribes to, so on a
  // genuinely fresh start `current_step` climbs to 1 a beat or two after
  // mount, mid-greeting. A live-reactive hasProgress then flips true and this
  // component bails to `children` before (or during) SplashIntro, skipping
  // the greeting -- the flow's own bookkeeping write masquerading as
  // "returning user, already past this screen". A real returning user's
  // step is already >= 1 in the FIRST fetched row (AppGate blocks render
  // until that fetch resolves), so a mount-time snapshot still resumes them
  // straight into chat; it just stops the flow's later write from closing
  // the gate on a session that started fresh.
  const [hasProgress] = useState(() => (state?.current_step ?? 0) >= 1);
  const [done, setDone] = useState(readSeen);
  const [phase, setPhase] = useState<Phase>('get-started');
  const navigate = useNavigate();

  // The clip the Get-started tap will start, held for SplashIntro to adopt.
  const openerRef = useRef<GestureStartedOpener | null>(null);

  // Warm the intro clip while the Get-started screen shows, so the tap claims
  // a buffered element (same B15 pool the flow beats use). Idempotent per src.
  useEffect(() => {
    if (done || hasProgress) return;
    preloadOpenerClips([INTRO_AUDIO_SRC]);
  }, [done, hasProgress]);

  // Gate unmounted mid-intro: stop the clip and return it to the pool.
  useEffect(
    () => () => {
      openerRef.current?.release();
      openerRef.current = null;
    },
    [],
  );

  if (done || hasProgress) return <>{children}</>;

  // Phase 1: Get Started screen. The button press is the gesture that unlocks audio.
  if (phase === 'get-started') {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{ fontFamily: FONT, gap: 40, padding: '0 32px' }}
      >
        {/* Brand block */}
        <div className="flex flex-col items-center" style={{ gap: 6 }}>
          <div
            style={{
              color: PRIMARY,
              fontFamily: FONT,
              fontSize: 'clamp(26px, 7vw, 30px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            Guided Growth
          </div>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase' as const,
              color: PRIMARY_70,
            }}
          >
            Behavioral OS
          </span>
        </div>

        {/* CTA cluster */}
        <div className="flex w-full flex-col items-center" style={{ gap: 16 }}>
          <Button
            variant="primary"
            size="auth"
            fullWidth
            onClick={() => {
              // Start the first coach clip INSIDE this gesture frame: playback
              // is deterministic (no deferred random-tap start later) and the
              // play() doubles as the audio unlock for every later beat.
              // SplashIntro adopts this element instead of re-playing it.
              openerRef.current ??= startOpenerFromGesture(INTRO_AUDIO_SRC);
              // Same gesture also blesses every beat clip (play+pause the
              // pooled elements), covering per-element autoplay policies for
              // the whole flow on main AND preview routes (B28).
              blessOpenerClipsInGesture(Object.values(ONBOARDING_BEAT_MP3S));
              setPhase('coach-greeting');
            }}
          >
            Get started
          </Button>
          <button
            type="button"
            style={{ fontFamily: FONT, color: SUBTLE, fontSize: 14, fontWeight: 600 }}
            onClick={() => navigate('/login')}
          >
            I already have an account
          </button>
        </div>
      </div>
    );
  }

  // Phase 2: Coach greeting. The clip is ALREADY playing (the Get-started tap
  // started it in its own gesture frame), so SplashIntro adopts that element
  // (adoptedOpener) rather than re-arming a second play().
  return (
    <SplashIntro
      autoPlay
      skipSplash
      audioSrc={INTRO_AUDIO_SRC}
      adoptedOpener={openerRef.current}
      onComplete={() => {
        openerRef.current?.release();
        openerRef.current = null;
        try {
          localStorage.setItem(INTRO_SEEN_KEY, '1');
        } catch {
          // best-effort; private mode just replays the intro next mount
        }
        setDone(true);
      }}
    />
  );
}

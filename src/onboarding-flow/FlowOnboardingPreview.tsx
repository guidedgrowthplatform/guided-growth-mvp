/**
 * FlowOnboardingPreview — a public, auth-free render of the chat-native flow.
 *
 * Same engine and renderer as the real FlowOnboarding, but with the local
 * (in-memory) persistence adapter so the whole flow is runnable in a browser
 * without login or Supabase. Used for QA + the design walkthrough. Mounted at
 * /onboarding-flow-preview (outside the AppGate). Not a user-facing route.
 *
 * Voice runs here too (Cartesia opener + Vapi), so it is a real no-login voice
 * walk, see the seeded anonId below.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { IntroGate } from './IntroGate';
import { useLocalPersistence } from './persistence';
import { FlowRenderer } from './renderer/FlowRenderer';
import { preloadOpenerClips } from './renderer/openerPreloadPool';
import { useFlow } from './useFlow';
import { useFlowOrchestrator } from './useFlowOrchestrator';

// Marks (and pins) the throwaway preview identity. The Supabase anon_id
// columns are uuid-typed, so the seeded id MUST be a plain uuid (the old
// `preview-` prefix made every anon-keyed REST call 400 (invalid input syntax
// for type uuid) and the mic-allow preference write wedged the beat). The
// "this is a preview identity" signal lives in this localStorage key instead
// of inside the id string; it also keeps the id stable across preview reloads.
const PREVIEW_ANON_ID_KEY = 'gg_preview_anon_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function previewAnonId(): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(PREVIEW_ANON_ID_KEY);
  } catch {
    /* private mode: fall through to a fresh id */
  }
  if (id && UUID_RE.test(id)) return id;
  id = crypto.randomUUID();
  try {
    localStorage.setItem(PREVIEW_ANON_ID_KEY, id);
  } catch {
    /* best-effort */
  }
  return id;
}

export function FlowOnboardingPreview() {
  // No session here, so anonId is null. Vapi's live-gate requires a non-empty
  // anon_id (the backend rejects empty ones, every tool call would fail), so
  // seed a throwaway one, a VALID uuid (see previewAnonId; previews point at
  // staging, junk rows are acceptable). This lets the auth-free walk run the
  // full Vapi path, not just the Cartesia opener. A real session overwrites it
  // on login.
  useEffect(() => {
    if (!useAuthStore.getState().anonId) {
      useAuthStore.setState({ anonId: previewAnonId() });
    }
  }, []);

  const { flow, tag } = useFlow(null);
  const persistence = useLocalPersistence();

  // Same B15 warm-up as the real FlowOnboarding: the preview is the QA surface,
  // so it must exercise the same preload path (it previously skipped the pool,
  // which made preview playback ride the network and hid B15 regressions).
  useEffect(() => {
    if (!flow) return;
    preloadOpenerClips(
      flow.nodes.flatMap((n) =>
        n.meta?.voiceOut?.engine === 'mp3' && n.meta.voiceOut.mp3Assets?.[0]?.file
          ? [n.meta.voiceOut.mp3Assets[0].file]
          : [],
      ),
    );
  }, [flow]);
  // QA: ?startAt=<nodeId> jumps past the auth/mic gates, same affordance the
  // real FlowOnboarding gives QAControlScreen — lets headless preview QA reach
  // specific beats without a sign-in.
  const [searchParams] = useSearchParams();
  const startAtNodeId = searchParams.get('startAt') ?? undefined;
  const orchestrator = useFlowOrchestrator(flow, persistence, { flowTag: tag, startAtNodeId });

  return (
    <div className="bg-background h-screen w-screen">
      <IntroGate>
        <FlowRenderer orchestrator={orchestrator} />
      </IntroGate>
    </div>
  );
}

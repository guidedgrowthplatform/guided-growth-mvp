// QA cost guard (2026-07-09): the QA fleet's per-turn coach replies were
// exercising live Cartesia at scale and drove Model Credits deeply negative
// (see gg-spec/docs/qa-round-loop-runbook.md "Cost guard"). When
// VITE_QA_STUB_TTS=true, the two live Cartesia TTS call sites
// (tts-service.ts + cartesiaVoice.ts) return a short canned local clip
// instead of hitting `/api/cartesia-tts` / `/api/cartesia-tts-sse`.
//
// Default is false — zero behavior change for real users and for the one
// canary walk per round that must keep proving the real Cartesia path
// works (run that walk with the flag unset/false).

/** Read inside call sites (not cached at module scope) so vitest's
 * vi.stubEnv() takes effect per-test — matches the pattern in posthog.ts. */
export function isQaStubTtsEnabled(): boolean {
  return import.meta.env.VITE_QA_STUB_TTS === 'true';
}

export const QA_STUB_TTS_MP3_PATH = '/voice/qa-stub.mp3';

let cachedStubBlob: Promise<Blob> | null = null;

/** Fetches the local canned MP3 once per session. Same-origin static asset —
 * never touches the Cartesia API or the `/api/cartesia-tts*` proxy routes. */
export function getQaStubTtsBlob(): Promise<Blob> {
  if (!cachedStubBlob) {
    cachedStubBlob = fetch(QA_STUB_TTS_MP3_PATH).then((res) => res.blob());
  }
  return cachedStubBlob;
}

/** Reset the cached blob fetch — test-only helper. */
export function resetQaStubTtsCacheForTests(): void {
  cachedStubBlob = null;
}

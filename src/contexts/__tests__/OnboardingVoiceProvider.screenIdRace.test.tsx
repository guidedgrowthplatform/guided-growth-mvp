/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Proves the registerScreen ref-race fix in OnboardingVoiceProvider.tsx.
 *
 * Bug: registerScreen used to update state (setRegisteredScreenId) and a
 * SEPARATE useEffect mirrored that state into registeredScreenIdRef one
 * commit later. The Vapi-path read sites (onCallStart, handleTranscript,
 * buildOverridesForCall, the debounced form-snapshot push) all read ONLY
 * the ref. If registerScreen(A) then registerScreen(B) fired in the same
 * synchronous tick — e.g. a rapid beat transition — and a Vapi event read
 * the ref in between (before the mirroring effect flushed), it saw A
 * instead of B: the wrong screen_id shipped to Vapi.
 *
 * Fix: registerScreen now writes registeredScreenIdRef.current directly,
 * synchronously, inside the callback itself — no effect indirection.
 *
 * This test mounts the REAL OnboardingVoiceProvider (not a reimplemented
 * pattern) and drives the actual bug conditions: registerScreen(A) then
 * registerScreen(B) called back-to-back with no act()/await flush between
 * them (simulating two rapid-fire beat-change calls landing in the same
 * tick), then immediately invokes the real buildOverridesForCall closure
 * (captured off the mocked useRealtimeVoice call) — one of the four real
 * ref-read call sites named in the bug report. If the ref were still
 * mirrored via a useEffect, it would not have flushed yet and this would
 * resolve screen A's context, not B's.
 *
 * Heavy leaf dependencies are mocked (Vapi/Daily via useRealtimeVoice,
 * the Direct-LLM chat hook) so the test targets registerScreen's ref
 * update in isolation; every other hook the provider calls
 * (useUserPreferences, useDualButtonControls, useSessionLog, the Zustand
 * stores) runs for real, unauthenticated, with no live network calls.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLogContext, type SessionLogContextValue } from '@/contexts/SessionLogContext';
import type { OnboardingVoiceContextValue } from '@/contexts/useOnboardingVoiceSession';
import { useAuthStore } from '@/stores/authStore';

// Two real beat ids from the onboarding beat bundle (also used by the sibling
// useOnboardingChat tests), so composeOnboardingContextBlock resolves them
// without falling back to a network fetch.
const SCREEN_A = 'ONBOARD-FORK--FORM';
const SCREEN_B = 'ONBOARD-BEGINNER-01';

// --- Mock useRealtimeVoice (Vapi/Daily) -----------------------------------
// The provider passes buildOverridesForCall in as `getAssistantOverrides`.
// Capturing the options object gives us a handle on that REAL closure (the
// literal function defined in OnboardingVoiceProvider.tsx, not a re-implementation)
// so we can invoke it directly, exactly as useRealtimeVoice.start() would
// right before vapi.start().
let lastRealtimeOptions: {
  getAssistantOverrides?: () => Promise<unknown>;
} | null = null;

vi.mock('@/hooks/useRealtimeVoice', () => ({
  useRealtimeVoice: (options: { getAssistantOverrides?: () => Promise<unknown> }) => {
    lastRealtimeOptions = options;
    return {
      state: 'idle' as const,
      error: null,
      isSpeaking: false,
      start: vi.fn(async () => {}),
      stop: vi.fn(),
      getClient: () => null,
      assistantVolumeLevel: 0,
      userAudioLevel: 0,
    };
  },
}));

// --- Mock useOnboardingChat (Direct-LLM path) -----------------------------
// Irrelevant to the ref race (a different engine path entirely) and heavy to
// mount for real (useLLM, useOnboardingChatSession, /api/context fetches).
vi.mock('@/hooks/useOnboardingChat', () => ({
  useOnboardingChat: () => ({
    sendUserTurn: vi.fn(),
    chatBusy: false,
    interrupt: vi.fn(),
    regenerate: vi.fn(),
  }),
}));

const { OnboardingVoiceProvider } = await import('@/contexts/OnboardingVoiceProvider');
const { useOnboardingVoice } = await import('@/contexts/useOnboardingVoiceSession');

const sessionCtx: SessionLogContextValue = {
  sessionId: 'test-session-id-race',
  logEvent: vi.fn(),
  startVoice: vi.fn(() => 'anchor'),
  endVoice: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let contextRef: OnboardingVoiceContextValue | null = null;

function Capture() {
  contextRef = useOnboardingVoice();
  return null;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/onboarding/some-beat']}>
      <QueryClientProvider client={qc}>
        <SessionLogContext.Provider value={sessionCtx}>{children}</SessionLogContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  lastRealtimeOptions = null;
  contextRef = null;
  useAuthStore.setState({ user: null, anonId: null } as never);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    // ignore
  }
  container.remove();
  vi.restoreAllMocks();
});

describe('OnboardingVoiceProvider — registeredScreenIdRef race (W2F screen_id bug)', () => {
  it('a same-tick register(A) then register(B), read synchronously by a real Vapi call site, resolves to B (not A)', async () => {
    act(() => {
      root.render(
        <Wrapper>
          <OnboardingVoiceProvider>
            <Capture />
          </OnboardingVoiceProvider>
        </Wrapper>,
      );
    });
    // Let the initial mount settle so useRealtimeVoice has been called once
    // and lastRealtimeOptions is populated.
    await act(async () => {
      await Promise.resolve();
    });

    expect(contextRef).not.toBeNull();
    expect(lastRealtimeOptions?.getAssistantOverrides).toBeTypeOf('function');

    // Land on screen A first and let it fully settle (state + ref + effects
    // all flushed) — this is the steady state a page sits in for a while
    // before the next beat transition. Both the old and new registerScreen
    // agree here: the ref reads A once this flush completes.
    act(() => {
      contextRef!.registerScreen(SCREEN_A);
    });

    // THE RACE: register B, then IMMEDIATELY read the ref via the real Vapi
    // call site — in the same synchronous tick, with NO act()/await/flush in
    // between. This is the literal shape of the bug: a beat-change call
    // landing, followed synchronously by a Vapi event, with no chance for
    // React to run a passive effect in between.
    //
    // registerScreen(B) itself calls setState (React schedules the re-render
    // for later) — deliberately NOT wrapped in act() here, so React does not
    // get an opportunity to flush/commit/run effects before the read below.
    // Under the fix, registeredScreenIdRef.current is written synchronously
    // inside registerScreen, so it already reads B by the time we read it.
    // Under the old buggy pattern, the ref is only mirrored from state by a
    // useEffect, which cannot have run yet — the ref would still read the
    // PRIOR settled value, A, not B.
    contextRef!.registerScreen(SCREEN_B);

    // Immediately invoke the REAL buildOverridesForCall closure (captured as
    // getAssistantOverrides off the mocked useRealtimeVoice call) — one of
    // the four ref-only read sites named in the bug report. This is the
    // exact call useRealtimeVoice.start() makes right before vapi.start().
    // It reads registeredScreenIdRef.current synchronously at its very top
    // (before its first await), so calling it here with no flush in between
    // exercises the real race window.
    let overridesResult: unknown;
    await act(async () => {
      overridesResult = await lastRealtimeOptions!.getAssistantOverrides!();
    });
    const overrides = overridesResult as
      | { variableValues?: { initial_screen_context?: string } }
      | undefined;

    expect(overrides).toBeDefined();
    const contextBlock = overrides!.variableValues!.initial_screen_context!;
    // Must reflect the NEW beat (B), not the stale prior one (A).
    expect(contextBlock).toContain(`CURRENT SCREEN: ${SCREEN_B}`);
    expect(contextBlock).not.toContain(`CURRENT SCREEN: ${SCREEN_A}`);
  });
});

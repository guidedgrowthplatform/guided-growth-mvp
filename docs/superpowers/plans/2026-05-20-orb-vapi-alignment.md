# Orb–Vapi Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both halves of the dual-button orb gate the Vapi WebRTC session symmetrically per UX-26, and fix three adjacent bugs (dual-STT race in chat overlay, 8s auto-mute over-determining, `startAttemptedRef` re-entry).

**Architecture:** A single derived value `vapiShouldRun` in `OnboardingVoiceProvider` replaces today's `voiceOff` check; the auto-start and auto-stop effects key off this. All four orb click handlers across `OnboardingLayout` and `OnboardingChatOverlay` follow a uniform OFF/ON protocol: imperative `endCall()` + pref-flip + optional `onClose()` on OFF, pref-flip + gated `restartCall()` on ON.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + React Testing Library (jsdom env), `@vapi-ai/web` SDK.

**Spec reference:** `docs/superpowers/specs/2026-05-20-orb-vapi-alignment-design.md`

**Files touched:**

- `src/contexts/OnboardingVoiceProvider.tsx` (modify) — gate, auto-stop effect, idle timer, add `prevShouldRunRef` effect
- `src/components/onboarding/OnboardingLayout.tsx` (modify) — `handleTtsToggleClick`, `handleMicToggleClick`
- `src/components/onboarding/OnboardingChatOverlay.tsx` (modify) — `handleToggleVoice`, `handleToggleMic`, dual-STT `useEffect` gate
- `src/contexts/__tests__/OnboardingVoiceProvider.test.tsx` (create) — gate / teardown / idle-timer / transition-reset tests

---

## Task 1 — Baseline verification

**Files:** none (read-only)

- [ ] **Step 1: Confirm clean working tree on feature branch**

Run: `git status && git branch --show-current`
Expected: `nothing to commit, working tree clean` AND branch is `feat/context-bundle-and-optimistic-session-log` (or whatever branch the user is on).

- [ ] **Step 2: Capture baseline test results**

Run: `npx vitest run 2>&1 | tail -20`
Expected: all existing tests pass. Note the test count (e.g. "25 passed"). If anything is failing before we start, STOP and ask the user — we need a green baseline so failures during this work are attributable to our changes.

- [ ] **Step 3: Capture baseline type check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors. If errors exist, STOP and ask.

---

## Task 2 — Create provider test scaffolding

**Files:**

- Create: `src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`

Mirror the pattern used in `src/contexts/__tests__/SessionLogProvider.test.tsx` (jsdom env, manual `createRoot` + `act`, `vi.hoisted` for module-level mocks).

- [ ] **Step 1: Write the test file with mocks and harness**

```typescript
/** @vitest-environment jsdom */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { useContext, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingVoiceContext } from '@/contexts/useOnboardingVoiceSession';
import { OnboardingVoiceProvider } from '@/contexts/OnboardingVoiceProvider';

// ----- Hoisted mock state (lets tests mutate refs that the mocks read) -----

const {
  prefsState,
  realtimeState,
  startMock,
  stopMock,
  getClientMock,
  logEventMock,
  startVoiceMock,
  endVoiceMock,
  updatePreferencesMock,
  realtimeOptionsRef,
} = vi.hoisted(() => ({
  prefsState: {
    current: {
      voiceMode: 'voice' as 'voice' | 'screen',
      micEnabled: true,
      micPermission: true,
      coachingStyle: 'warm',
    },
  },
  realtimeState: { current: 'idle' as 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' },
  startMock: vi.fn().mockResolvedValue(undefined),
  stopMock: vi.fn(),
  getClientMock: vi.fn(() => null),
  logEventMock: vi.fn(),
  startVoiceMock: vi.fn(() => 'anchor-1'),
  endVoiceMock: vi.fn(),
  updatePreferencesMock: vi.fn(),
  realtimeOptionsRef: { current: null as any },
}));

// ----- Module mocks -----

vi.mock('@/hooks/useRealtimeVoice', () => ({
  useRealtimeVoice: (opts: any) => {
    realtimeOptionsRef.current = opts;
    return {
      start: startMock,
      stop: stopMock,
      state: realtimeState.current,
      isActive: realtimeState.current === 'listening' || realtimeState.current === 'thinking' || realtimeState.current === 'speaking',
      isListening: realtimeState.current === 'listening',
      isSpeaking: realtimeState.current === 'speaking',
      error: null,
      getClient: getClientMock,
    };
  },
}));

vi.mock('@/hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: prefsState.current,
    updatePreferences: (patch: Partial<typeof prefsState.current>) => {
      updatePreferencesMock(patch);
      prefsState.current = { ...prefsState.current, ...patch };
    },
  }),
}));

vi.mock('@/hooks/useSessionLog', () => ({
  useSessionLog: () => ({
    logEvent: logEventMock,
    startVoice: startVoiceMock,
    endVoice: endVoiceMock,
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) => selector({ anonId: 'test-anon-id' }),
}));

vi.mock('@/lib/context/screenContextsBundle', () => ({
  getBundledRoutes: () => [
    { route: '/onboarding/step1', screen_id: 'ONBOARD-01' },
  ],
}));

vi.mock('@/lib/context/screenIdForRoute', () => ({
  screenIdForRoute: (_routes: any, path: string) =>
    path.startsWith('/onboarding/') ? 'ONBOARD-01' : null,
}));

vi.mock('@/lib/context/getScreenContext', () => ({
  getScreenContext: vi.fn().mockResolvedValue({
    screen_id: 'ONBOARD-01',
    context_block: '',
    state_delta: [],
  }),
}));

vi.mock('@/lib/context/buildContextMessage', () => ({
  buildContextMessage: () => '',
}));

vi.mock('@/analytics', () => ({ track: vi.fn() }));

// ----- Test harness -----

let container: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let ctxRef: { current: any } = { current: null };

function Bridge() {
  const ctx = useContext(OnboardingVoiceContext);
  // eslint-disable-next-line react-hooks/globals -- test bridge: capture context for assertions
  ctxRef.current = ctx;
  return null;
}

function mount(path = '/onboarding/step1') {
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <OnboardingVoiceProvider>
            <Bridge />
          </OnboardingVoiceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

function setRealtimeState(next: typeof realtimeState.current) {
  realtimeState.current = next;
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/onboarding/step1']}>
          <OnboardingVoiceProvider>
            <Bridge />
          </OnboardingVoiceProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  prefsState.current = {
    voiceMode: 'voice',
    micEnabled: true,
    micPermission: true,
    coachingStyle: 'warm',
  };
  realtimeState.current = 'idle';
  startMock.mockClear();
  stopMock.mockClear();
  updatePreferencesMock.mockClear();
  logEventMock.mockClear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  ctxRef.current = null;
});

afterEach(() => {
  try {
    act(() => root.unmount());
  } catch {
    /* already unmounted */
  }
  container.remove();
});

describe('OnboardingVoiceProvider — placeholder', () => {
  it('mounts without error', () => {
    mount();
    expect(ctxRef.current).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the placeholder test**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`
Expected: 1 test passes ("mounts without error").

If the test fails because of a missing mock or context import, fix the import path / add the missing mock until it passes. The scaffolding has to be solid before the behavior tests land.

- [ ] **Step 3: Commit scaffolding**

```bash
git add src/contexts/__tests__/OnboardingVoiceProvider.test.tsx
git commit -m "test(onboarding-voice): scaffolding for provider tests"
```

If the pre-commit hook fails on pre-existing lint warnings in other files, ask the user how to proceed (the warnings are not in our new file).

---

## Task 3 — Tighten the gate (`vapiShouldRun`)

**Files:**

- Modify: `src/contexts/OnboardingVoiceProvider.tsx:329` (gate definition) + `:334` (auto-start) + `:399` (auto-stop)
- Test: `src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to the test file (replace the placeholder `describe` block with this):

```typescript
describe('OnboardingVoiceProvider — vapiShouldRun gate', () => {
  it('auto-starts Vapi when voiceMode=voice + micPermission=true + micEnabled=true', async () => {
    mount();
    // Effect needs a tick to run.
    await act(async () => {});
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-start when micPermission=false', async () => {
    prefsState.current = { ...prefsState.current, micPermission: false };
    mount();
    await act(async () => {});
    expect(startMock).not.toHaveBeenCalled();
  });

  it('does NOT auto-start when micEnabled=false', async () => {
    prefsState.current = { ...prefsState.current, micEnabled: false };
    mount();
    await act(async () => {});
    expect(startMock).not.toHaveBeenCalled();
  });

  it('does NOT auto-start when voiceMode=screen', async () => {
    prefsState.current = { ...prefsState.current, voiceMode: 'screen' };
    mount();
    await act(async () => {});
    expect(startMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`
Expected: The first test passes (today's `voiceOff` already handles that case). The 2 mic-related tests FAIL — they currently auto-start because today's gate only checks `voiceMode`.

If all four pass already, something is wrong with the test setup — investigate before continuing.

- [ ] **Step 3: Tighten the gate in the provider**

Open `src/contexts/OnboardingVoiceProvider.tsx`. Find lines 325-329:

```typescript
// Vapi session lifecycle is owned by the LEFT orb (voiceMode) only. The mic
// orb is mute-only — it controls a runtime track on an already-live session
// and never starts or tears down the connection. So "voice off" alone is
// the gate, not "both orbs off".
const voiceOff = preferences.voiceMode !== 'voice';
```

Replace with:

```typescript
// Vapi session lifecycle is gated by BOTH halves of the orb per UX-26.
// Vapi runs only in State 1 (mic ON + AI ON + permission granted). Any half
// off tears the WebRTC session down — intentional cost-conscious behavior.
const vapiShouldRun =
  preferences.voiceMode === 'voice' &&
  preferences.micPermission === true &&
  preferences.micEnabled === true;
```

- [ ] **Step 4: Update the auto-start effect**

In the same file, find the auto-start effect (lines 331-344):

```typescript
  useEffect(() => {
    if (
      inOnboarding &&
      !voiceOff &&
      status === 'idle' &&
```

Replace `!voiceOff` with `vapiShouldRun`. The full block becomes:

```typescript
useEffect(() => {
  if (
    inOnboarding &&
    vapiShouldRun &&
    status === 'idle' &&
    currentScreenId &&
    !fatalErrorRef.current &&
    !startAttemptedRef.current
  ) {
    startAttemptedRef.current = true;
    void start();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [inOnboarding, vapiShouldRun, status, currentScreenId]);
```

Note: the dep array changes too (`voiceOff` → `vapiShouldRun`).

- [ ] **Step 5: Update the auto-stop effect**

Find lines 397-407:

```typescript
  useEffect(() => {
    if (!inOnboarding) return;
    if (!voiceOff) return;
    clearRetryTimer();
```

Change `!voiceOff` to `!vapiShouldRun`:

```typescript
useEffect(() => {
  if (!inOnboarding) return;
  if (vapiShouldRun) return;
  clearRetryTimer();
  retryCountRef.current = 0;
  startAttemptedRef.current = false;
  if (status === 'active' || status === 'connecting') {
    stop();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [inOnboarding, vapiShouldRun, status]);
```

- [ ] **Step 6: Run tests to verify all four pass**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 7: Run the full suite + type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green; no new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/contexts/OnboardingVoiceProvider.tsx src/contexts/__tests__/OnboardingVoiceProvider.test.tsx
git commit -m "feat(onboarding-voice): tighten Vapi gate to require both orb halves + permission"
```

---

## Task 4 — Add `prevShouldRunRef` to allow re-entry

**Files:**

- Modify: `src/contexts/OnboardingVoiceProvider.tsx` (add new effect after the `currentScreenId` reset effect at lines 142-144)
- Test: `src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`

Today, `startAttemptedRef` gets stuck `true` for the lifetime of a screen. Once Vapi auto-starts on a screen, the ref blocks any subsequent auto-start — so toggling the gate false → true within the same screen wouldn't re-enter Vapi. The new effect resets the ref on each false → true transition.

- [ ] **Step 1: Write the failing test**

Add to the test file:

```typescript
describe('OnboardingVoiceProvider — startAttemptedRef re-entry', () => {
  it('re-enters Vapi after mic toggles off then on within the same screen', async () => {
    mount();
    await act(async () => {});
    expect(startMock).toHaveBeenCalledTimes(1);

    // Simulate Vapi reaching active, then user toggles mic off.
    realtimeState.current = 'listening';
    prefsState.current = { ...prefsState.current, micEnabled: false };
    setRealtimeState('listening'); // triggers re-render with new gate value
    await act(async () => {});

    // Auto-stop fired:
    expect(stopMock).toHaveBeenCalled();

    // Simulate stop completing (state back to idle), then user toggles mic on.
    realtimeState.current = 'idle';
    prefsState.current = { ...prefsState.current, micEnabled: true };
    setRealtimeState('idle');
    await act(async () => {});

    expect(startMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx -t 're-enters Vapi'`
Expected: FAIL — `startMock` is called once (not twice) because `startAttemptedRef.current` stays `true`.

- [ ] **Step 3: Implement the transition-reset effect**

In `OnboardingVoiceProvider.tsx`, find the existing `startAttemptedRef` declaration (line 140) and the per-screen reset effect (lines 142-144):

```typescript
const startAttemptedRef = useRef(false);

useEffect(() => {
  startAttemptedRef.current = false;
}, [currentScreenId]);
```

Immediately after the per-screen reset effect, add the new effect. Place it BEFORE the auto-start effect (which is later in the file at line 331) so effect execution order keeps the gate-transition reset from running after auto-start sets the ref to true.

The new code:

```typescript
const startAttemptedRef = useRef(false);

useEffect(() => {
  startAttemptedRef.current = false;
}, [currentScreenId]);

// Reset the per-screen gate when vapiShouldRun transitions false → true so
// mic-off → mic-on within one screen can re-enter Vapi. Tri-state seed (null
// → first-render capture) avoids a spurious reset on initial mount: if the
// gate is true on first render the auto-start effect runs first and sets
// startAttemptedRef to true; without the null seed, this effect would then
// see prev=false, curr=true and flip the ref back to false, causing a re-fire.
const prevShouldRunRef = useRef<boolean | null>(null);
useEffect(() => {
  if (prevShouldRunRef.current === null) {
    prevShouldRunRef.current = vapiShouldRun;
    return;
  }
  if (vapiShouldRun && !prevShouldRunRef.current) {
    startAttemptedRef.current = false;
  }
  prevShouldRunRef.current = vapiShouldRun;
}, [vapiShouldRun]);
```

Important: `vapiShouldRun` is declared at line 329 (or 330 after our Task 3 edit). The new effect uses it, so it needs to come AFTER the `vapiShouldRun` declaration. That means physically placing it just below `vapiShouldRun = ...` rather than right next to `startAttemptedRef`. If `vapiShouldRun` is declared further down than the per-screen reset effect, that's fine — leave the per-screen reset where it is and put the new effect after the `vapiShouldRun` declaration.

Actual placement: after the `vapiShouldRun` block (around line 329-330 post-Task 3), and BEFORE the auto-start effect (line 331).

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx -t 're-enters Vapi'`
Expected: PASS.

- [ ] **Step 5: Run full provider suite + full test suite + type check**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx && npx vitest run && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/OnboardingVoiceProvider.tsx src/contexts/__tests__/OnboardingVoiceProvider.test.tsx
git commit -m "fix(onboarding-voice): allow re-entry when gate transitions false to true"
```

---

## Task 5 — Redesign 8s auto-mute (flip `micEnabled`, not `voiceMode`)

**Files:**

- Modify: `src/contexts/OnboardingVoiceProvider.tsx:362-369` (`armIdleTimer` body)
- Test: `src/contexts/__tests__/OnboardingVoiceProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the test file:

```typescript
describe('OnboardingVoiceProvider — 8s idle timer', () => {
  it('flips micEnabled (not voiceMode) on 8s silence', async () => {
    vi.useFakeTimers();
    try {
      mount();
      await act(async () => {});

      // Move Vapi to active + listening + simulate assistant has spoken so
      // the idle timer arms (warm-up gate cleared).
      realtimeState.current = 'speaking';
      setRealtimeState('speaking');
      await act(async () => {});

      realtimeState.current = 'listening';
      setRealtimeState('listening');
      await act(async () => {});

      updatePreferencesMock.mockClear();

      act(() => {
        vi.advanceTimersByTime(8000);
      });
      await act(async () => {});

      expect(updatePreferencesMock).toHaveBeenCalledWith({ micEnabled: false });
      expect(updatePreferencesMock).not.toHaveBeenCalledWith({ voiceMode: 'screen' });
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx -t '8s silence'`
Expected: FAIL — current code calls `updatePreferences({ voiceMode: 'screen' })`.

- [ ] **Step 3: Update `armIdleTimer`**

In `OnboardingVoiceProvider.tsx`, find `armIdleTimer` (lines 360-369 in the original; line numbers will have shifted slightly from Task 3 and 4):

```typescript
const armIdleTimer = useCallback(() => {
  clearIdleTimer();
  idleTimerRef.current = setTimeout(() => {
    idleTimerRef.current = null;
    void updatePreferences({ voiceMode: 'screen' });
    stop();
  }, IDLE_TIMEOUT_MS);
}, [clearIdleTimer, stop, updatePreferences]);
```

Replace with:

```typescript
const armIdleTimer = useCallback(() => {
  clearIdleTimer();
  idleTimerRef.current = setTimeout(() => {
    idleTimerRef.current = null;
    // Conceptually a mic-side event, not an AI-output event. Preserving
    // voiceMode means the user can come back, tap-mic-only, and re-enter
    // State 1 directly. The auto-stop effect catches the gate flip and
    // tears down Vapi.
    void updatePreferences({ micEnabled: false });
  }, IDLE_TIMEOUT_MS);
}, [clearIdleTimer, updatePreferences]);
```

Note the dep array also changes — `stop` is removed.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/contexts/__tests__/OnboardingVoiceProvider.test.tsx -t '8s silence'`
Expected: PASS.

- [ ] **Step 5: Run full suite + type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/OnboardingVoiceProvider.tsx src/contexts/__tests__/OnboardingVoiceProvider.test.tsx
git commit -m "feat(onboarding-voice): 8s idle flips micEnabled instead of voiceMode"
```

---

## Task 6 — `OnboardingLayout.handleMicToggleClick` — symmetric teardown + restart

**Files:**

- Modify: `src/components/onboarding/OnboardingLayout.tsx:174-197`

Component-level handler change. No new unit tests (covered by provider tests + manual smoke; component tests for layouts aren't part of this work per spec §14).

- [ ] **Step 1: Read the file to confirm current line numbers**

Run: `sed -n '170,200p' src/components/onboarding/OnboardingLayout.tsx`
Expected: shows `handleMicToggleClick` starting around line 174 with the `if (vapiActive)` branch.

- [ ] **Step 2: Replace `handleMicToggleClick` body**

Find the existing handler (currently lines 174-197):

```typescript
const handleMicToggleClick = () => {
  setTooltipVisible(false);
  localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
  if (vapiActive) {
    const next = vapiIsMuted;
    onboardingVoice?.setMicEnabled(next);
    void updatePreferences({ micEnabled: next });
    return;
  }
  if (!micGranted) {
    void (async () => {
      let granted = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        granted = false;
      }
      await updatePreferences({ micPermission: granted, micEnabled: granted });
    })();
    return;
  }
  void updatePreferences({ micEnabled: !preferences.micEnabled });
};
```

Replace with:

```typescript
const handleMicToggleClick = () => {
  setTooltipVisible(false);
  localStorage.setItem('onboarding-voice-tooltip-shown', 'true');
  // Off-click while live: tear down Vapi (UX-26 — both halves are session
  // gates). Mirrors handleTtsToggleClick.
  if (vapiActive || vapiConnecting) {
    onboardingVoice?.endCall();
    void updatePreferences({ micEnabled: false });
    useVoiceSettingsStore.getState().hydrate({ micEnabled: false });
    return;
  }
  // Permission-grant flow — fires on first tap when mic is not yet allowed.
  if (!micGranted) {
    void (async () => {
      let granted = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        granted = false;
      }
      await updatePreferences({ micPermission: granted, micEnabled: granted });
      useVoiceSettingsStore.getState().hydrate({ micEnabled: granted });
    })();
    return;
  }
  // ON path after a prior off: flip pref, hydrate the local store, and if
  // voice mode is on (gate becomes true), kick restartCall to bypass the
  // 'ended' status lock from a previous endCall().
  const turningOn = !preferences.micEnabled;
  void updatePreferences({ micEnabled: turningOn });
  useVoiceSettingsStore.getState().hydrate({ micEnabled: turningOn });
  if (turningOn && voiceChosen) {
    void onboardingVoice?.restartCall();
  }
};
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors. If `vapiConnecting` is not in scope, check that it's destructured from `onboardingVoice` higher up in the component (it is, line 79).

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/OnboardingLayout.tsx
git commit -m "feat(onboarding-orb): mic toggle tears down Vapi symmetrically"
```

---

## Task 7 — `OnboardingLayout.handleTtsToggleClick` — tighten ON guard

**Files:**

- Modify: `src/components/onboarding/OnboardingLayout.tsx:149-172`

Today line 171 unconditionally calls `restartCall()` when the user flips voice on. After our gate tightening, that would spawn Vapi even when mic is off (auto-stop would tear it back down — wasteful flicker).

- [ ] **Step 1: Update the ON-click branch**

Find the existing ON branch at the bottom of `handleTtsToggleClick` (around lines 166-172):

```typescript
    const nextChosen = !voiceChosen;
    void updatePreferences({ voiceMode: nextChosen ? 'voice' : 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: nextChosen });
    // On-click after a prior end/idle stop: the auto-start gate is armed for
    // this screen, so the pref flip alone won't reopen the session. Kick it.
    if (nextChosen) void onboardingVoice?.restartCall();
  };
```

Replace with:

```typescript
    const nextChosen = !voiceChosen;
    void updatePreferences({ voiceMode: nextChosen ? 'voice' : 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: nextChosen });
    // On-click after a prior end/idle stop: the status is 'ended' (didCallStop)
    // so the auto-start effect bails. Kick it via restartCall — but only when
    // the gate will also be true (mic granted + enabled). Otherwise we'd spawn
    // Vapi and immediately tear it down via the auto-stop effect.
    if (nextChosen && micGranted && preferences.micEnabled) {
      void onboardingVoice?.restartCall();
    }
  };
```

- [ ] **Step 2: Also update the comment at the top of the handler**

Find the comment block on lines 152-159 (the comment introducing the off-click branch):

```typescript
    // When Vapi is in error state, the left orb doubles as the retry control.
    if (vapiErrored) {
      void onboardingVoice?.restartCall();
      return;
    }
    // Off-click while the session is live (or coming up): tear it down to
    // cap cost — same intent as the 8s idle-timeout in OnboardingVoiceProvider.
    // Don't just mute the assistant track; the WebRTC session keeps billing.
    if (vapiActive || vapiConnecting) {
```

No code change here — but the inline comment "session lifecycle owned by LEFT orb only" framing referenced in the spec lives elsewhere; the layout comment already reflects the new model.

- [ ] **Step 3: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/OnboardingLayout.tsx
git commit -m "fix(onboarding-orb): only restart Vapi on TTS-on when gate is satisfied"
```

---

## Task 8 — `OnboardingChatOverlay.handleToggleVoice` — protocol parity

**Files:**

- Modify: `src/components/onboarding/OnboardingChatOverlay.tsx:148-153`

- [ ] **Step 1: Replace the handler**

Find the existing handler:

```typescript
const handleToggleVoice = useCallback(() => {
  const next = !voiceChosen;
  if (!next) stopTTS();
  void updatePreferences({ voiceMode: next ? 'voice' : 'screen' });
  useVoiceSettingsStore.getState().hydrate({ ttsEnabled: next });
}, [voiceChosen, updatePreferences]);
```

Replace with:

```typescript
const handleToggleVoice = useCallback(() => {
  const turningOff = voiceChosen;
  if (turningOff) {
    // OFF path: tear down Vapi, close overlay (UX-26 — chat overlay is a
    // State 1 surface; leaving State 1 means leaving the overlay).
    onboardingVoiceSession?.endCall();
    stopTTS();
    void updatePreferences({ voiceMode: 'screen' });
    useVoiceSettingsStore.getState().hydrate({ ttsEnabled: false });
    onClose();
    return;
  }
  // ON path: flip pref. Restart Vapi only if mic is also on — else the
  // auto-stop effect would tear it back down (flicker).
  void updatePreferences({ voiceMode: 'voice' });
  useVoiceSettingsStore.getState().hydrate({ ttsEnabled: true });
  if (micRuntimeOn) {
    void onboardingVoiceSession?.restartCall();
  }
}, [voiceChosen, micRuntimeOn, updatePreferences, onboardingVoiceSession, onClose]);
```

- [ ] **Step 2: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/OnboardingChatOverlay.tsx
git commit -m "feat(onboarding-chat): voice toggle off tears down Vapi + closes overlay"
```

---

## Task 9 — `OnboardingChatOverlay.handleToggleMic` — protocol parity

**Files:**

- Modify: `src/components/onboarding/OnboardingChatOverlay.tsx:155-164`

- [ ] **Step 1: Replace the handler**

Find:

```typescript
const handleToggleMic = useCallback(() => {
  if (!micAllowed) return;
  const turningOn = !micRuntimeOn;
  if (turningOn) {
    unlockTTS();
    stopTTS();
    processedTranscriptRef.current = '';
  }
  void updatePreferences({ micEnabled: turningOn });
}, [micAllowed, micRuntimeOn, updatePreferences]);
```

Replace with:

```typescript
const handleToggleMic = useCallback(() => {
  if (!micAllowed) return;
  // OFF while Vapi live: tear down + close overlay (UX-26).
  if (vapiActive) {
    onboardingVoiceSession?.endCall();
    void updatePreferences({ micEnabled: false });
    useVoiceSettingsStore.getState().hydrate({ micEnabled: false });
    onClose();
    return;
  }
  // ON path: unlock TTS, stop residual TTS, reset transcript, flip pref.
  // Restart Vapi only if voice mode is on (gate will be true).
  const turningOn = !micRuntimeOn;
  if (turningOn) {
    unlockTTS();
    stopTTS();
    processedTranscriptRef.current = '';
  }
  void updatePreferences({ micEnabled: turningOn });
  useVoiceSettingsStore.getState().hydrate({ micEnabled: turningOn });
  if (turningOn && voiceChosen) {
    void onboardingVoiceSession?.restartCall();
  }
}, [
  micAllowed,
  micRuntimeOn,
  vapiActive,
  voiceChosen,
  onboardingVoiceSession,
  onClose,
  updatePreferences,
]);
```

- [ ] **Step 2: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/OnboardingChatOverlay.tsx
git commit -m "feat(onboarding-chat): mic toggle off tears down Vapi + closes overlay"
```

---

## Task 10 — Dual-STT guard in `OnboardingChatOverlay`

**Files:**

- Modify: `src/components/onboarding/OnboardingChatOverlay.tsx:181-195`

Today's effect starts the local `useVoiceInput` STT whenever mic is on — including when Vapi is also running its own STT, causing parallel audio capture.

- [ ] **Step 1: Update the gate**

Find:

```typescript
useEffect(() => {
  if (!micRuntimeOn) {
    if (isListening) toggle();
    return;
  }
  if (!isListening && !isProcessing && !isSpeaking) {
    const timer = setTimeout(() => {
      if (!useTtsPlaybackStore.getState().isSpeaking && !isProcessing) {
        unlockTTS();
        toggle();
      }
    }, 300);
    return () => clearTimeout(timer);
  }
}, [micRuntimeOn, isListening, isProcessing, isSpeaking, toggle]);
```

Replace with (add `vapiActive` to the early-return gate and the dep array):

```typescript
useEffect(() => {
  // When Vapi is running it owns the mic — don't double-capture via
  // Cartesia-based useVoiceInput STT.
  if (vapiActive || !micRuntimeOn) {
    if (isListening) toggle();
    return;
  }
  if (!isListening && !isProcessing && !isSpeaking) {
    const timer = setTimeout(() => {
      if (!useTtsPlaybackStore.getState().isSpeaking && !isProcessing) {
        unlockTTS();
        toggle();
      }
    }, 300);
    return () => clearTimeout(timer);
  }
}, [vapiActive, micRuntimeOn, isListening, isProcessing, isSpeaking, toggle]);
```

- [ ] **Step 2: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/OnboardingChatOverlay.tsx
git commit -m "fix(onboarding-chat): don't run Cartesia STT in parallel with Vapi"
```

---

## Task 11 — Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full lint**

Run: `npm run lint 2>&1 | tail -20` (or whatever lint script the repo uses; check `package.json`).
Expected: no new warnings in the files we touched. Pre-existing warnings in other files (from the user's WIP) may still be present — leave those alone.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run 2>&1 | tail -20`
Expected: all tests pass. Test count should be baseline + N (where N = number of new provider tests added in Tasks 3-5).

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: production build succeeds.

- [ ] **Step 5: Manual smoke (UI verification)**

UI changes can't be fully covered by unit tests. The user needs to run through these manually before merge:

1. Start dev server: `npm run dev` (in another terminal start API if needed).
2. Sign in / advance to a screen that mounts `OnboardingLayout` with `showVoiceButton=true` and the user has mic permission granted + voiceMode='voice'.
3. **State 1 entry:** verify Vapi connects (orb both halves blue).
4. **Right-orb off mid-session:** tap mic half. Verify within ~100ms: orb mic half goes gray, Vapi session ends (no audio, console shows session ended).
5. **Right-orb on:** tap mic half back on. Vapi reconnects.
6. **Left-orb off mid-session:** tap AI half. Vapi ends. AI half goes gray.
7. **Left-orb on:** Vapi reconnects.
8. **Open chat overlay** (via `OpenChatButton`). Verify orb both halves blue.
9. **Tap either half off in overlay:** overlay closes AND Vapi ends.
10. **8s idle test:** open overlay, get into listening state, sit silent. After 8s: mic half goes gray, AI half STAYS blue. Vapi tears down.
11. **Cross-check baseline:** run a full onboarding pass from scratch as a regression check — make sure form-driven flow + chat overlay flow still complete normally.

Report any deviation to the user before merging.

- [ ] **Step 6: Update task list + announce completion**

After all manual smoke passes, report to the user: "All 11 tasks complete. Spec §15 acceptance criteria verified. Ready for review / merge."

---

## Notes for the executor

- The pre-existing lint warnings in `OnboardingChatOverlay.tsx` (`Send` unused import) and `SessionLogProvider.test.tsx` (`ctxRef` reassignment, import order) are NOT in scope. Don't touch them. If `lint --max-warnings=0` fails because of these during a commit, ask the user how to proceed — do not "fix" their WIP and do not use `--no-verify` without explicit authorization.

- Line numbers in this plan are from the spec snapshot — they will drift slightly as tasks are completed (gate change in Task 3 shifts subsequent lines by a few rows). Use `grep` / `sed` to locate by content rather than relying on the exact line number.

- The provider is sensitive code. Each task has its own commit so anything that goes wrong is bisectable.

- If the auto-start effect doesn't fire in tests, it's likely because `currentScreenId` resolves to `null`. The mock for `screenIdForRoute` always returns `'ONBOARD-01'` for paths starting with `/onboarding/`, which is what `mount()` uses by default — but if you change the mounted path, update the mock.

- `vi.useFakeTimers()` only mocks `setTimeout`/`setInterval`; the React effect that ARMS the timer still needs the component to re-render. Use the `setRealtimeState()` helper to re-render with new mocked Vapi state, then `vi.advanceTimersByTime(8000)` to fire the timer.

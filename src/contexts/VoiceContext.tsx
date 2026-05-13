import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VoiceContext } from '@/contexts/voiceContextDef';
import type {
  BroadcastState,
  CaptureState,
  RealtimePhase,
  ReflectPhase,
  ReleaseToken,
  Surface,
  VoiceOwner,
  VoiceState,
} from '@/contexts/voiceContextDef';

function mintToken(): ReleaseToken {
  return crypto.randomUUID() as ReleaseToken;
}

function voiceStateFromOwner(owner: VoiceOwner): VoiceState {
  switch (owner.kind) {
    case 'idle':
      return 'idle';
    case 'broadcast':
      return 'mp3';
    case 'realtime':
      return owner.phase;
    case 'reflect-loop':
      if (owner.phase === 'listening' || owner.phase === 'thinking' || owner.phase === 'speaking') {
        return owner.phase;
      }
      // 'playing-prompt' and 'transcribing' have no legacy peer; map to nearest.
      return owner.phase === 'transcribing' ? 'thinking' : 'listening';
    case 'capture-only':
      return 'listening';
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [owner, setOwnerState] = useState<VoiceOwner>({ kind: 'idle' });

  // ownerRef mirrors state for synchronous reads inside the same render cycle.
  const ownerRef = useRef<VoiceOwner>(owner);
  const cleanupsRef = useRef<Map<ReleaseToken, () => void>>(new Map());
  // Reentrancy guard — a cleanup that calls releaseToken again unwinds without recursing.
  const releasingRef = useRef(false);

  const setOwner = useCallback((next: VoiceOwner) => {
    ownerRef.current = next;
    setOwnerState(next);
  }, []);

  const runAllCleanups = useCallback(() => {
    const fns = Array.from(cleanupsRef.current.values());
    cleanupsRef.current.clear();
    for (const fn of fns) {
      try {
        fn();
      } catch (err) {
        console.error('[VoiceContext] cleanup threw', err);
      }
    }
  }, []);

  const acquireRealtime = useCallback(
    (opts: { surface: Surface; onCleanup: () => void }): ReleaseToken | null => {
      if (ownerRef.current.kind === 'realtime') return ownerRef.current.token;
      if (ownerRef.current.kind !== 'idle') runAllCleanups();
      const token = mintToken();
      cleanupsRef.current.set(token, opts.onCleanup);
      setOwner({ kind: 'realtime', surface: opts.surface, phase: 'listening', token });
      return token;
    },
    [runAllCleanups, setOwner],
  );

  const acquireBroadcast = useCallback(
    (opts: { surface: Surface; assetId: string; onCleanup: () => void }): ReleaseToken | null => {
      if (ownerRef.current.kind === 'broadcast') return ownerRef.current.token;
      if (ownerRef.current.kind !== 'idle') runAllCleanups();
      const token = mintToken();
      cleanupsRef.current.set(token, opts.onCleanup);
      setOwner({
        kind: 'broadcast',
        surface: opts.surface,
        assetId: opts.assetId,
        state: 'loading',
        token,
      });
      return token;
    },
    [runAllCleanups, setOwner],
  );

  const acquireReflectLoop = useCallback(
    (opts: { surface: Surface; onCleanup: () => void }): ReleaseToken | null => {
      if (ownerRef.current.kind === 'reflect-loop') return ownerRef.current.token;
      if (ownerRef.current.kind !== 'idle') runAllCleanups();
      const token = mintToken();
      cleanupsRef.current.set(token, opts.onCleanup);
      setOwner({ kind: 'reflect-loop', surface: opts.surface, phase: 'playing-prompt', token });
      return token;
    },
    [runAllCleanups, setOwner],
  );

  const acquireCaptureOnly = useCallback(
    (opts: { surface: Surface; onCleanup: () => void }): ReleaseToken | null => {
      if (ownerRef.current.kind === 'capture-only') return ownerRef.current.token;
      if (ownerRef.current.kind !== 'idle') runAllCleanups();
      const token = mintToken();
      cleanupsRef.current.set(token, opts.onCleanup);
      setOwner({ kind: 'capture-only', surface: opts.surface, state: 'listening', token });
      return token;
    },
    [runAllCleanups, setOwner],
  );

  const setStatus = useCallback(
    (token: ReleaseToken, phase: RealtimePhase) => {
      const cur = ownerRef.current;
      if (cur.kind === 'realtime' && cur.token === token) {
        setOwner({ ...cur, phase });
      }
    },
    [setOwner],
  );

  const setPhase = useCallback(
    (token: ReleaseToken, phase: ReflectPhase) => {
      const cur = ownerRef.current;
      if (cur.kind === 'reflect-loop' && cur.token === token) {
        setOwner({ ...cur, phase });
      }
    },
    [setOwner],
  );

  const setBroadcastState = useCallback(
    (token: ReleaseToken, state: BroadcastState) => {
      const cur = ownerRef.current;
      if (cur.kind === 'broadcast' && cur.token === token) {
        setOwner({ ...cur, state });
      }
    },
    [setOwner],
  );

  const setCaptureState = useCallback(
    (token: ReleaseToken, state: CaptureState) => {
      const cur = ownerRef.current;
      if (cur.kind === 'capture-only' && cur.token === token) {
        setOwner({ ...cur, state });
      }
    },
    [setOwner],
  );

  const releaseToken = useCallback(
    (token: ReleaseToken) => {
      if (releasingRef.current) return;
      releasingRef.current = true;
      try {
        const fn = cleanupsRef.current.get(token);
        cleanupsRef.current.delete(token);
        if (fn) {
          try {
            fn();
          } catch (err) {
            console.error('[VoiceContext] cleanup threw', err);
          }
        }
        const cur = ownerRef.current;
        if (cur.kind !== 'idle' && cur.token === token) {
          setOwner({ kind: 'idle' });
        }
      } finally {
        releasingRef.current = false;
      }
    },
    [setOwner],
  );

  const voiceState = voiceStateFromOwner(owner);

  const value = useMemo(
    () => ({
      owner,
      voiceState,
      acquireRealtime,
      acquireBroadcast,
      acquireReflectLoop,
      acquireCaptureOnly,
      setStatus,
      setPhase,
      setBroadcastState,
      setCaptureState,
      releaseToken,
    }),
    [
      owner,
      voiceState,
      acquireRealtime,
      acquireBroadcast,
      acquireReflectLoop,
      acquireCaptureOnly,
      setStatus,
      setPhase,
      setBroadcastState,
      setCaptureState,
      releaseToken,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

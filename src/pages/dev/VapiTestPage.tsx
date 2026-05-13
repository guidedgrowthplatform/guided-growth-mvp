import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { fetchScreenRoutes } from '@/api/context';
import { IconMic } from '@/components/icons/IconMic';
import { IconMicMuted } from '@/components/icons/IconMicMuted';
import { DualButton } from '@/components/ui/DualButton';
import { useToast } from '@/contexts/ToastContext';
import { useVapiCall, VAPI_ENV_MISSING_ERROR } from '@/hooks/useVapiCall';
import { queryKeys } from '@/lib/query/keys';

const DEFAULT_SCREEN = 'ONBOARD-FORK';

export function VapiTestPage() {
  const {
    status,
    isMuted,
    isAssistantSpeaking,
    errorMessage,
    start,
    stop,
    toggleMute,
    refreshContext,
  } = useVapiCall();
  const { addToast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const isEnvMissing = errorMessage === VAPI_ENV_MISSING_ERROR;

  const routesQuery = useQuery({
    queryKey: queryKeys.context.routes(),
    queryFn: fetchScreenRoutes,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedScreen, setSelectedScreen] = useState(DEFAULT_SCREEN);
  const [lastPushedScreen, setLastPushedScreen] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage && errorMessage !== lastErrorRef.current && !isEnvMissing) {
      lastErrorRef.current = errorMessage;
      addToast('error', errorMessage);
    }
  }, [errorMessage, addToast, isEnvMissing]);

  const isActive = status === 'active';
  const isConnecting = status === 'connecting';

  const handleRightClick = () => {
    if (isActive || isConnecting) {
      stop();
    } else {
      setLastPushedScreen(selectedScreen);
      void start(selectedScreen);
    }
  };

  const handlePushContext = async () => {
    setLastPushedScreen(selectedScreen);
    await refreshContext(selectedScreen);
    addToast('success', `Pushed context for ${selectedScreen}`);
  };

  const statusLabel: Record<typeof status, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    active: 'In call',
    ended: 'Call ended',
    error: 'Error',
  };

  const screens = routesQuery.data?.routes ?? [];

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-12">
        <header className="mb-10">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Dev / Smoke test
          </p>
          <h1 className="mt-2 text-2xl font-bold">Coach Yair</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Vapi web SDK round-trip — pick a screen, start a call, then switch screens to verify the
            context push.
          </p>
        </header>

        {isEnvMissing && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-danger bg-danger/10 p-3 text-sm text-content"
          >
            Vapi is not configured. Set <code>VITE_VAPI_PUBLIC_KEY</code> and{' '}
            <code>VITE_VAPI_ASSISTANT_ID</code> in your <code>.env.local</code>, then restart the
            dev server.
          </div>
        )}

        <div className="mb-8 space-y-3">
          <label className="block">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Screen
            </span>
            <select
              value={selectedScreen}
              onChange={(e) => setSelectedScreen(e.target.value)}
              className="bg-background mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {screens.length === 0 && <option value={DEFAULT_SCREEN}>{DEFAULT_SCREEN}</option>}
              {screens.map((s) => (
                <option key={s.screen_id} value={s.screen_id}>
                  {s.screen_id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handlePushContext}
            disabled={!isActive}
            className="bg-background hover:bg-muted w-full rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Switch screen (push context now)
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-10">
          <DualButton
            size={140}
            leftActive={!isMuted}
            rightActive={isActive}
            activeRings={isAssistantSpeaking ? 'right' : null}
            ringCount={3}
            ringStep={6}
            leftIcon={isMuted ? <IconMicMuted size={28} /> : <IconMic size={28} />}
            rightIcon={<IconMic size={28} />}
            onLeftClick={isActive ? toggleMute : undefined}
            onRightClick={handleRightClick}
            leftAriaLabel={isMuted ? 'Unmute mic' : 'Mute mic'}
            rightAriaLabel={isActive ? 'End call' : 'Start call'}
          />

          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{statusLabel[status]}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Mic</dt>
              <dd className="font-medium">{isMuted ? 'Muted' : 'Live'}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Coach speaking</dt>
              <dd className="font-medium">{isAssistantSpeaking ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Last context push</dt>
              <dd className="font-medium">{lastPushedScreen ?? '—'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

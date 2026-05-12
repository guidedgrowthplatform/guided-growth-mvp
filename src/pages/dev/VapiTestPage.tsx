import { useEffect, useRef } from 'react';
import { IconMic } from '@/components/icons/IconMic';
import { IconMicMuted } from '@/components/icons/IconMicMuted';
import { DualButton } from '@/components/ui/DualButton';
import { useToast } from '@/contexts/ToastContext';
import { useVapiCall } from '@/hooks/useVapiCall';

export function VapiTestPage() {
  const { status, isMuted, isAssistantSpeaking, errorMessage, start, stop, toggleMute } =
    useVapiCall();
  const { addToast } = useToast();
  const lastErrorRef = useRef<string | null>(null);
  const isEnvMissing = errorMessage?.startsWith('Vapi env vars missing') ?? false;

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
      void start();
    }
  };

  const statusLabel: Record<typeof status, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    active: 'In call',
    ended: 'Call ended',
    error: 'Error',
  };

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-12">
        <header className="mb-10">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Dev / Smoke test
          </p>
          <h1 className="mt-2 text-2xl font-bold">Coach Yair</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Vapi web SDK round-trip — tap the right button to start a call.
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
          </dl>
        </div>
      </div>
    </div>
  );
}

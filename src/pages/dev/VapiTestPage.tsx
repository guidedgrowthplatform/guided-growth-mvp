import { useEffect, useRef } from 'react';
import { IconMic } from '@/components/icons/IconMic';
import { DualButton } from '@/components/ui/DualButton';
import { useToast } from '@/contexts/ToastContext';
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice';

const DEV_USER_ID =
  (import.meta.env.VITE_DEV_USER_ID as string | undefined) ?? '00000000-0000-0000-0000-000000000000';

export function VapiTestPage() {
  const { state, isSpeaking, error, start, stop } = useRealtimeVoice({
    metadata: { user_id: DEV_USER_ID, screen: 'onboard_01', coaching_style: 'warm' },
  });
  const { addToast } = useToast();
  const lastErrorRef = useRef<string | null>(null);

  const isEnvMissing = !!error && /Vapi env vars missing/.test(error);

  useEffect(() => {
    if (error && error !== lastErrorRef.current && !isEnvMissing) {
      lastErrorRef.current = error;
      addToast('error', error);
    }
  }, [error, addToast, isEnvMissing]);

  const isActive = state === 'listening' || state === 'speaking';
  const isConnecting = state === 'connecting';
  const handleRightClick = () => {
    if (isActive || isConnecting) {
      stop();
    } else {
      void start();
    }
  };

  const statusLabel: Record<typeof state, string> = {
    idle: 'Idle',
    connecting: 'Connecting…',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
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
            leftActive={false}
            rightActive={isActive}
            activeRings={isSpeaking ? 'right' : null}
            ringCount={3}
            ringStep={6}
            leftIcon={<IconMic size={28} />}
            rightIcon={<IconMic size={28} />}
            onRightClick={handleRightClick}
            rightAriaLabel={isActive ? 'End call' : 'Start call'}
          />

          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{statusLabel[state]}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Coach speaking</dt>
              <dd className="font-medium">{isSpeaking ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

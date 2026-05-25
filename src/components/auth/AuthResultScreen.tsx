import { Capacitor } from '@capacitor/core';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';
import { type AuthHandoffKind, buildHandoffUrl } from '@/lib/auth/authHandoff';

interface AuthResultScreenProps {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  handoffKind?: AuthHandoffKind;
  iconName?: string;
  iconTone?: 'primary' | 'warning' | 'danger';
}

const TONE_CLASSES: Record<NonNullable<AuthResultScreenProps['iconTone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function AuthResultScreen({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  handoffKind,
  iconName,
  iconTone = 'primary',
}: AuthResultScreenProps) {
  const showOpenInApp = !Capacitor.isNativePlatform() && handoffKind !== undefined;
  const openInApp = () => {
    if (!handoffKind) return;
    window.location.href = buildHandoffUrl(handoffKind);
  };
  const primaryIsAccent = !showOpenInApp;

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mt-6">
        {iconName && (
          <div
            className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${TONE_CLASSES[iconTone]}`}
          >
            <Icon icon={iconName} width={28} height={28} />
          </div>
        )}
        <h1 className="text-[30px] font-bold tracking-tight text-content">{title}</h1>
        <p className="mt-2 whitespace-pre-line text-base text-content-secondary">{body}</p>
      </div>

      <div className="mt-8 space-y-4">
        {showOpenInApp && (
          <Button variant="primary" size="auth-rect" fullWidth onClick={openInApp}>
            Open in app
          </Button>
        )}
        <Button
          variant={primaryIsAccent ? 'primary' : 'secondary'}
          size="auth-rect"
          fullWidth
          onClick={onPrimary}
        >
          {primaryLabel}
        </Button>
        {secondaryLabel && onSecondary && (
          <Button variant="ghost" size="auth-rect" fullWidth onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>

      <div className="flex-1" />
    </div>
  );
}

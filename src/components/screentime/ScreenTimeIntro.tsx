import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/Button';

interface ScreenTimeIntroProps {
  busy?: boolean;
  denied?: boolean;
  onGetStarted: () => void;
}

const BULLETS: { icon: string; text: string }[] = [
  { icon: 'mdi:lock-outline', text: 'Private by design — data never leaves your iPhone' },
  { icon: 'mdi:shape-outline', text: 'You choose which apps — and can change your mind' },
  { icon: 'mdi:power', text: 'Turn it off anytime, instantly' },
];

export function ScreenTimeIntro({ busy, denied, onGetStarted }: ScreenTimeIntroProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
      <div className="relative flex h-[116px] w-[116px] items-center justify-center">
        <div className="absolute inset-0 animate-ripple-slow rounded-full bg-primary/20" />
        <div className="absolute inset-[14px] rounded-full bg-primary/10" />
        <Icon icon="mdi:timer-sand" width={44} className="relative text-primary" />
      </div>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-[25px] font-extrabold tracking-[-0.3px] text-content">
          Your time, on your terms
        </h2>
        <p className="mx-auto max-w-[300px] text-[14.5px] leading-relaxed text-content-secondary">
          See how you spend time in your apps and set gentle limits — for yourself, by yourself.
        </p>
      </div>

      <div className="w-full overflow-hidden rounded-2xl bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
        {BULLETS.map((b, i) => (
          <div
            key={b.icon}
            className={`flex items-center gap-3 px-4 py-[13px] ${
              i > 0 ? 'border-t border-border-light' : ''
            }`}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/[0.06]">
              <Icon icon={b.icon} width={22} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-content">{b.text}</p>
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-2.5">
        <Button size="auth" fullWidth loading={busy} onClick={onGetStarted}>
          Get started
        </Button>
        <p className="mx-auto max-w-[300px] text-center text-xs leading-relaxed text-content-tertiary">
          {denied
            ? 'Access was declined earlier — you can allow it anytime in your iPhone Settings.'
            : 'Apple will ask for permission next. Guided Growth never sees or uploads this data.'}
        </p>
      </div>
    </div>
  );
}

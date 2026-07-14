import { Icon } from '@iconify/react';

export type ShieldReason = 'limit' | 'break' | 'winddown';

interface ShieldCopy {
  icon: string;
  title: string;
  body: string;
}

const SHIELDS: Record<ShieldReason, ShieldCopy> = {
  limit: {
    icon: 'mdi:instagram',
    title: 'Instagram is resting',
    body: "You set a 2-hour daily limit, and you've reached it for today. It'll be back tomorrow morning.",
  },
  break: {
    icon: 'mdi:timer-sand',
    title: "You're on a break",
    body: "You asked for 30 minutes of quiet. 22 minutes to go — you've got this.",
  },
  winddown: {
    icon: 'mdi:weather-night',
    title: 'Winding down',
    body: "It's past 10:30 PM — you planned to be offline by now. Tomorrow starts tonight.",
  },
};

interface ShieldPreviewProps {
  reason?: ShieldReason;
  onPrimary: () => void;
  onSecondary?: () => void;
}

// Design reference for the native iOS shield (ShieldConfiguration extension).
// At runtime the block screen is rendered by iOS, not this component — this
// mirrors the copy/tone so the native extension can match it.
export function ShieldPreview({ reason = 'limit', onPrimary, onSecondary }: ShieldPreviewProps) {
  const shield = SHIELDS[reason];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-gradient-to-b from-[#DCE6FA] via-[#EDF2FC] to-[#F5F8FD] px-8 pb-14 pt-20 text-center">
      <div className="relative flex h-[150px] w-[150px] items-center justify-center">
        <div className="absolute inset-0 animate-ripple-slow rounded-full bg-primary/[0.12]" />
        <div className="absolute inset-[18px] animate-ripple-med rounded-full bg-primary/[0.14]" />
        <div className="relative flex h-[84px] w-[84px] items-center justify-center rounded-[24px] bg-white shadow-[0px_10px_25px_rgba(14,68,177,0.15)]">
          <Icon icon={shield.icon} width={42} className="text-primary" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <h2 className="text-[26px] font-extrabold tracking-[-0.3px] text-[#12285A]">
          {shield.title}
        </h2>
        <p className="max-w-[300px] text-[15.5px] leading-relaxed text-[#47588A]">{shield.body}</p>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          className="flex h-[54px] w-full items-center justify-center rounded-full bg-primary text-base font-bold text-white shadow-[0px_8px_20px_rgba(19,91,235,0.25)]"
        >
          Back to my day
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="flex h-[54px] w-full items-center justify-center rounded-full bg-white text-base font-bold text-primary shadow-[0px_4px_14px_rgba(14,68,177,0.1)]"
        >
          Give me 5 more minutes
        </button>
        <p className="mt-1 max-w-[280px] text-[12.5px] leading-relaxed text-[#7C8CB5]">
          You&rsquo;re always in control — adjust this anytime in Guided Growth.
        </p>
      </div>
    </div>
  );
}

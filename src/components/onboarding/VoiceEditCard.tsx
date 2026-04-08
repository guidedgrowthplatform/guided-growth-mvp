import { Icon } from '@iconify/react';

interface VoiceEditCardProps {
  onMicPress?: () => void;
}

export function VoiceEditCard({ onMicPress }: VoiceEditCardProps) {
  return (
    <div
      className="flex items-center justify-between overflow-clip rounded-[16px] border border-primary/20 p-[21px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
      style={{ background: 'linear-gradient(162deg, rgb(var(--color-primary-bg)) 0%, rgb(var(--color-primary)/0.15) 100%)' }}
    >
      <div className="flex-1 pr-[16px]">
        <div className="mb-[4px] flex items-center gap-[8px]">
          <div className="rounded-[8px] bg-primary p-[6px]">
            <Icon icon="ic:round-mic" width={16} height={16} className="text-white" />
          </div>
          <span className="text-[16px] font-bold leading-[24px] text-primary">Edit with Voice</span>
        </div>
        <p className="text-[12px] font-normal leading-[19.5px] text-content-muted">
          Just say what you want to change, like
          <br />
          &quot;Change schedule to weekends only&quot;
        </p>
      </div>
      <button
        type="button"
        onClick={onMicPress}
        className="flex size-[56px] shrink-0 items-center justify-center rounded-full bg-primary shadow-[0px_10px_15px_-3px_rgb(var(--color-primary)/0.25),0px_4px_6px_-4px_rgb(var(--color-primary)/0.15)]"
      >
        <Icon icon="ic:round-mic" width={24} height={24} className="text-white" />
      </button>
    </div>
  );
}

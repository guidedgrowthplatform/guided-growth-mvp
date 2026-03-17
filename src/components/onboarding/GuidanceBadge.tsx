interface GuidanceBadgeProps {
  text: string;
}

export function GuidanceBadge({ text }: GuidanceBadgeProps) {
  return (
    <div className="flex items-center gap-[8px] self-start rounded-full bg-[#e9f0ff] px-[20px] py-[10px]">
      <span className="text-[14px]">✨</span>
      <span className="text-[12px] font-semibold uppercase leading-[16px] tracking-[0.6px] text-[#135bec]">
        {text}
      </span>
    </div>
  );
}

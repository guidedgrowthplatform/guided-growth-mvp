interface Props {
  title: string;
}

export function SettingSectionHeader({ title }: Props) {
  return (
    <h3 className="px-1 text-xs font-extrabold uppercase tracking-[1.2px] text-content-tertiary">
      {title}
    </h3>
  );
}

interface AuthDividerProps {
  text: string;
  uppercase?: boolean;
  bold?: boolean;
}

export function AuthDivider({ text, uppercase, bold }: AuthDividerProps) {
  return (
    <div className="flex items-center gap-4">
      <hr className="flex-1 border-border" />
      <span
        className={`text-sm text-content-tertiary ${uppercase ? 'uppercase' : ''} ${bold ? 'font-bold' : ''}`}
      >
        {text}
      </span>
      <hr className="flex-1 border-border" />
    </div>
  );
}

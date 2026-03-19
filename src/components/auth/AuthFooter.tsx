import { Link } from 'react-router-dom';

interface AuthFooterProps {
  text: string;
  linkText: string;
  to: string;
}

export function AuthFooter({ text, linkText, to }: AuthFooterProps) {
  return (
    <div className="flex items-center justify-center gap-1 text-sm">
      <span className="font-medium text-content-secondary">{text}</span>
      <Link to={to} className="font-bold text-primary">
        {linkText}
      </Link>
    </div>
  );
}

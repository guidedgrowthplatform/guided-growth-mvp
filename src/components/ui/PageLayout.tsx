import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  className?: string;
  padBottom?: boolean;
}

export function PageLayout({
  children,
  title,
  subtitle,
  headerRight,
  className = '',
  padBottom,
}: PageLayoutProps) {
  return (
    <div
      className={`mx-auto max-w-lg px-4 pt-4 ${padBottom ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : 'pb-4'} ${className}`}
    >
      {(title || headerRight) && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold text-content">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-sm text-content-secondary">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

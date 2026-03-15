import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  className?: string;
  padBottom?: boolean;
}

export function PageLayout({ children, title, subtitle, headerRight, className = '', padBottom }: PageLayoutProps) {
  return (
    <div className={`max-w-lg mx-auto px-4 pt-4 ${padBottom ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : 'pb-4'} ${className}`}>
      {(title || headerRight) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h1 className="text-2xl font-bold text-content">{title}</h1>}
            {subtitle && <p className="text-sm text-content-secondary mt-0.5">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

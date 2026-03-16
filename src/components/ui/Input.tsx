import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div>
        {label && <label className="mb-1 block text-sm font-medium text-content">{label}</label>}
        <input
          ref={ref}
          className={`w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary ${error ? 'border-danger' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

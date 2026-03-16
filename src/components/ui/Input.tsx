import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div>
        {label && <label className="block text-sm font-medium text-content mb-1">{label}</label>}
        <input
          ref={ref}
          className={`w-full px-3 py-2 text-sm border border-border rounded-md bg-surface outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${error ? 'border-danger' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

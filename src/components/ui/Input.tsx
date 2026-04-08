import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'auth';
  showPasswordToggle?: boolean;
}

const variantStyles = {
  default: 'rounded-md border border-border bg-surface px-3 py-2 text-sm',
  auth: 'rounded-[24px] h-14 px-5 text-base bg-white border-border shadow-[0px_0px_0px_1px_rgb(var(--color-border))]',
} as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, variant = 'default', showPasswordToggle, className = '', type, ...props },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div>
        {label && <label className="mb-1 block text-sm font-medium text-content">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            type={inputType}
            className={`w-full outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary ${variantStyles[variant]} ${error ? 'border-danger' : ''} ${isPassword && showPasswordToggle ? 'pr-12' : ''} ${className}`}
            {...props}
          />
          {isPassword && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-content-tertiary transition-colors hover:text-content-secondary"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-sm font-medium text-danger">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

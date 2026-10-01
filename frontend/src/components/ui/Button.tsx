import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-indigo-600',
};

export const buttonClasses = (variant: Variant = 'primary') =>
  `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`;

export function Button({ variant = 'primary', loading = false, disabled, children, className = '', ...props }: ButtonProps) {
  return (
    <button className={`${buttonClasses(variant)} ${className}`} disabled={disabled || loading} {...props}>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}

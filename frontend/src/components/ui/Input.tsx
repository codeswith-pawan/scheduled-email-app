import { useId, type InputHTMLAttributes } from 'react';
import { FormField, fieldClasses } from './FormField';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', ...props }: InputProps) {
  const id = useId();
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldClasses(Boolean(error))} ${className}`}
        {...props}
      />
    </FormField>
  );
}

import { useId, type TextareaHTMLAttributes } from 'react';
import { FormField, fieldClasses } from './FormField';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', ...props }: TextareaProps) {
  const id = useId();
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${fieldClasses(Boolean(error))} ${className}`}
        {...props}
      />
    </FormField>
  );
}

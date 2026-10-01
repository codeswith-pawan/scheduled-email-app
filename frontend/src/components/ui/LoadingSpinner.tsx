interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({ label, className = '' }: LoadingSpinnerProps) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-12 text-slate-600 ${className}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

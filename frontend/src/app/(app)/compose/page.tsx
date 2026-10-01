import { ComposeForm } from '@/components/ComposeForm';

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Compose email</h1>
        <p className="mt-1 text-sm text-slate-500">Pick a future date and time. Your local time zone is used.</p>
      </div>
      <ComposeForm />
    </div>
  );
}

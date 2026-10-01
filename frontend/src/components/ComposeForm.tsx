'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api';
import { parseLocalDateTime, toDateInputValue, toTimeInputValue } from '@/lib/format';
import { Button } from './ui/Button';
import { ErrorMessage } from './ui/ErrorMessage';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';

type FieldErrors = Partial<Record<'toEmail' | 'subject' | 'body' | 'scheduledAt', string>>;

const QUICK_DELAYS_MINUTES = [1, 2, 5];

function validate(values: { toEmail: string; subject: string; body: string; scheduledAt: Date | null }): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^\S+@\S+\.\S+$/.test(values.toEmail.trim())) errors.toEmail = 'Enter a valid recipient email address';
  if (!values.subject.trim()) errors.subject = 'Subject is required';
  else if (values.subject.length > 200) errors.subject = 'Subject must be at most 200 characters';
  if (!values.body.trim()) errors.body = 'Message is required';
  if (!values.scheduledAt) errors.scheduledAt = 'Choose a date and time';
  else if (values.scheduledAt.getTime() <= Date.now()) errors.scheduledAt = 'Scheduled time must be in the future';
  return errors;
}

export function ComposeForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setSendIn(minutes: number) {
    // Round up to the next whole minute because the time input has no seconds.
    const target = new Date(Math.ceil((Date.now() + minutes * 60_000) / 60_000) * 60_000);
    setDate(toDateInputValue(target));
    setTime(toTimeInputValue(target));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const scheduledAt = parseLocalDateTime(date, time);
    const fieldErrors = validate({ toEmail, subject, body, scheduledAt });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || !scheduledAt) return;

    setSubmitting(true);
    try {
      await api.scheduleEmail({
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        scheduledAt: scheduledAt.toISOString(),
      });
      showToast('success', 'Email scheduled.');
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors((error.details ?? {}) as FieldErrors);
        setFormError(error.details ? 'Please fix the highlighted fields.' : error.message);
      } else {
        setFormError('Could not schedule the email. Please try again.');
      }
      showToast('error', 'Email could not be scheduled.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {formError && <ErrorMessage message={formError} />}
      <Input
        label="Recipient"
        type="email"
        placeholder="name@example.com"
        value={toEmail}
        onChange={(event) => setToEmail(event.target.value)}
        error={errors.toEmail}
        disabled={submitting}
      />
      <Input
        label="Subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        error={errors.subject}
        disabled={submitting}
      />
      <Textarea
        label="Message"
        rows={6}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        error={errors.body}
        disabled={submitting}
      />
      <div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Date"
            type="date"
            min={toDateInputValue(new Date())}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={submitting}
          />
          <Input
            label="Time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            disabled={submitting}
          />
        </div>
        {errors.scheduledAt && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {errors.scheduledAt}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>Send in:</span>
          {QUICK_DELAYS_MINUTES.map((minutes) => (
            <Button key={minutes} type="button" variant="secondary" className="px-3 py-1" onClick={() => setSendIn(minutes)} disabled={submitting}>
              {minutes} min
            </Button>
          ))}
        </div>
      </div>
      <Button type="submit" loading={submitting} className="w-full sm:w-auto">
        {submitting ? 'Scheduling...' : 'Schedule Email'}
      </Button>
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { Button } from './ui/Button';
import { ErrorMessage } from './ui/ErrorMessage';
import { Input } from './ui/Input';

type Mode = 'login' | 'register';

const copy = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    switchText: 'No account yet?',
    switchLink: { href: '/register', label: 'Create one' },
  },
  register: {
    title: 'Create account',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchLink: { href: '/login', label: 'Log in' },
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Password is required';
    else if (mode === 'register' && password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await (mode === 'login' ? login(email.trim(), password) : register(email.trim(), password));
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.details ?? {});
        setFormError(error.details ? null : error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  const text = copy[mode];

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">{text.title}</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <ErrorMessage message={formError} />}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            hint={mode === 'register' ? 'At least 8 characters' : undefined}
          />
          <Button type="submit" loading={submitting} className="w-full">
            {text.submit}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {text.switchText}{' '}
          <Link href={text.switchLink.href} className="font-medium text-indigo-600 hover:underline">
            {text.switchLink.label}
          </Link>
        </p>
        {mode === 'login' && (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
            Local demo account (after <code>npm run seed</code>): demo@example.com / Demo@12345
          </p>
        )}
      </div>
    </div>
  );
}

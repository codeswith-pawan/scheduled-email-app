'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmailDetailsModal } from '@/components/EmailDetailsModal';
import { EmailsTable } from '@/components/EmailsTable';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useEmails } from '@/lib/useEmails';
import type { Email } from '@/types';

type Tab = 'scheduled' | 'sent';

export default function DashboardPage() {
  const { scheduled, sent, loading, error, refresh } = useEmails();
  const [tab, setTab] = useState<Tab>('scheduled');
  const [selected, setSelected] = useState<Email | null>(null);

  const emails = tab === 'scheduled' ? scheduled : sent;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'scheduled', label: 'Scheduled Emails', count: scheduled.length },
    { id: 'sent', label: 'Sent Emails', count: sent.length },
  ];

  function renderContent() {
    if (loading) return <LoadingSpinner label="Loading emails..." />;
    if (error) {
      return (
        <div className="p-4">
          <ErrorMessage message={error} onRetry={() => void refresh()} />
        </div>
      );
    }
    if (emails.length === 0) {
      return tab === 'scheduled' ? (
        <EmptyState
          title="No scheduled emails yet."
          description="Emails you schedule will appear here until they are sent."
          action={
            <Link href="/compose" className={buttonClasses()}>
              Compose email
            </Link>
          }
        />
      ) : (
        <EmptyState title="No sent emails yet." description="Emails appear here once they have been delivered or have failed." />
      );
    }
    return <EmailsTable emails={emails} variant={tab} onSelect={setSelected} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Link href="/compose" className={buttonClasses()}>
          Compose email
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div role="tablist" className="flex gap-1 border-b border-slate-200 px-2 pt-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium ${
                tab === item.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {!loading && !error && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.count}</span>}
            </button>
          ))}
        </div>
        {renderContent()}
      </div>

      <EmailDetailsModal email={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

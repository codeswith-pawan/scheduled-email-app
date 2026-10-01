import { formatDateTime } from '@/lib/format';
import type { Email } from '@/types';
import { StatusBadge } from './ui/StatusBadge';
import { Table, type Column } from './ui/Table';

interface EmailsTableProps {
  emails: Email[];
  variant: 'scheduled' | 'sent';
  onSelect: (email: Email) => void;
}

const recipient: Column<Email> = {
  key: 'to',
  header: 'Recipient',
  render: (email) => <span className="break-all">{email.toEmail}</span>,
};

const subject: Column<Email> = {
  key: 'subject',
  header: 'Subject',
  render: (email) => (
    <div className="max-w-xs">
      <p className="truncate">{email.subject}</p>
      {email.status === 'failed' && email.errorMessage && (
        <p className="mt-0.5 truncate text-xs text-red-600" title={email.errorMessage}>
          {email.errorMessage}
        </p>
      )}
    </div>
  ),
};

const status: Column<Email> = {
  key: 'status',
  header: 'Status',
  render: (email) => <StatusBadge status={email.status} />,
};

const scheduledColumns: Column<Email>[] = [
  recipient,
  subject,
  {
    key: 'scheduledAt',
    header: 'Scheduled time',
    className: 'whitespace-nowrap',
    render: (email) => formatDateTime(email.scheduledAt),
  },
  status,
  {
    key: 'createdAt',
    header: 'Created',
    className: 'whitespace-nowrap text-slate-500',
    render: (email) => formatDateTime(email.createdAt),
  },
];

// Failed emails have no sent_at, so the time of the last attempt is shown instead.
const sentColumns: Column<Email>[] = [
  recipient,
  subject,
  {
    key: 'sentAt',
    header: 'Sent time',
    className: 'whitespace-nowrap',
    render: (email) => formatDateTime(email.sentAt ?? email.updatedAt),
  },
  status,
];

export function EmailsTable({ emails, variant, onSelect }: EmailsTableProps) {
  return (
    <Table
      columns={variant === 'scheduled' ? scheduledColumns : sentColumns}
      rows={emails}
      getRowKey={(email) => email.id}
      onRowClick={onSelect}
    />
  );
}

import { formatDateTime } from '@/lib/format';
import type { Email } from '@/types';
import { Modal } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';

interface EmailDetailsModalProps {
  email: Email | null;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 break-words text-slate-900">{children}</dd>
    </div>
  );
}

export function EmailDetailsModal({ email, onClose }: EmailDetailsModalProps) {
  return (
    <Modal open={email !== null} title="Email details" onClose={onClose}>
      {email && (
        <dl className="space-y-3">
          <Row label="To">{email.toEmail}</Row>
          <Row label="Subject">{email.subject}</Row>
          <Row label="Status">
            <StatusBadge status={email.status} />
          </Row>
          <Row label="Scheduled for">{formatDateTime(email.scheduledAt)}</Row>
          {email.sentAt && <Row label="Sent at">{formatDateTime(email.sentAt)}</Row>}
          {email.errorMessage && (
            <Row label="Error">
              <span className="text-red-700">{email.errorMessage}</span>
            </Row>
          )}
          <Row label="Message">
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3">{email.body}</p>
          </Row>
        </dl>
      )}
    </Modal>
  );
}

import { getPool } from './pool';
import type { EmailRow } from '../types';

const COLUMNS =
  'id, user_id, to_email, subject, body, scheduled_at, status, sent_at, error_message, created_at, updated_at';

export interface NewEmail {
  userId: string;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

export async function createEmail(input: NewEmail): Promise<EmailRow> {
  const { rows } = await getPool().query<EmailRow>(
    `INSERT INTO emails (user_id, to_email, subject, body, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING ${COLUMNS}`,
    [input.userId, input.toEmail, input.subject, input.body, input.scheduledAt],
  );
  return rows[0] as EmailRow;
}

export async function findEmailById(id: string): Promise<EmailRow | null> {
  const { rows } = await getPool().query<EmailRow>(`SELECT ${COLUMNS} FROM emails WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findEmailForUser(id: string, userId: string): Promise<EmailRow | null> {
  const { rows } = await getPool().query<EmailRow>(
    `SELECT ${COLUMNS} FROM emails WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

export async function listScheduledForUser(userId: string): Promise<EmailRow[]> {
  const { rows } = await getPool().query<EmailRow>(
    `SELECT ${COLUMNS} FROM emails
     WHERE user_id = $1 AND status IN ('scheduled', 'processing')
     ORDER BY scheduled_at ASC`,
    [userId],
  );
  return rows;
}

export async function listSentForUser(userId: string): Promise<EmailRow[]> {
  const { rows } = await getPool().query<EmailRow>(
    `SELECT ${COLUMNS} FROM emails
     WHERE user_id = $1 AND status IN ('sent', 'failed')
     ORDER BY COALESCE(sent_at, updated_at) DESC`,
    [userId],
  );
  return rows;
}

/**
 * Atomically moves an email from "scheduled" to "processing". Returns null when
 * another worker already claimed it or it is no longer eligible, which is what
 * prevents the same email from being sent twice.
 */
export async function claimForProcessing(id: string): Promise<EmailRow | null> {
  const { rows } = await getPool().query<EmailRow>(
    `UPDATE emails SET status = 'processing', updated_at = now()
     WHERE id = $1 AND status = 'scheduled'
     RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function markSent(id: string): Promise<void> {
  await getPool().query(
    `UPDATE emails SET status = 'sent', sent_at = now(), error_message = NULL, updated_at = now()
     WHERE id = $1`,
    [id],
  );
}

export async function markFailed(id: string, errorMessage: string): Promise<void> {
  await getPool().query(
    `UPDATE emails SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
    [id, errorMessage],
  );
}

export async function releaseForRetry(id: string, errorMessage: string): Promise<void> {
  await getPool().query(
    `UPDATE emails SET status = 'scheduled', error_message = $2, updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [id, errorMessage],
  );
}

/** Emails stuck in "processing" (worker crashed mid-send) go back to "scheduled". */
export async function resetStaleProcessing(staleBefore: Date): Promise<number> {
  const result = await getPool().query(
    `UPDATE emails
     SET status = 'scheduled', error_message = 'Recovered after interrupted processing', updated_at = now()
     WHERE status = 'processing' AND updated_at < $1`,
    [staleBefore],
  );
  return result.rowCount ?? 0;
}

export async function listAllScheduled(): Promise<Pick<EmailRow, 'id' | 'scheduled_at'>[]> {
  const { rows } = await getPool().query<Pick<EmailRow, 'id' | 'scheduled_at'>>(
    `SELECT id, scheduled_at FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`,
  );
  return rows;
}

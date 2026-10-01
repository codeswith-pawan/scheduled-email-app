import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '../src/db/pool';
import { enqueueEmail, getEmailJobState, removeEmailJob } from '../src/queues/emailQueue';
import { reconcileEmails } from '../src/services/reconciliationService';
import { inMinutes, registerUser, scheduleEmail } from './helpers/api';
import { clearDb, setupTestDb } from './helpers/testDb';

beforeAll(setupTestDb);
beforeEach(async () => {
  await clearDb();
  vi.mocked(enqueueEmail).mockClear();
  vi.mocked(removeEmailJob).mockClear();
  vi.mocked(getEmailJobState).mockReset();
  vi.mocked(getEmailJobState).mockResolvedValue('missing');
});

async function scheduleOne(scheduledAt = inMinutes(5)) {
  const { token } = await registerUser();
  const response = await scheduleEmail(token, { scheduledAt });
  vi.mocked(enqueueEmail).mockClear();
  return response.body.data as { id: string; scheduledAt: string };
}

describe('reconcileEmails', () => {
  it('re-creates missing jobs for scheduled emails (e.g. after Redis lost its data)', async () => {
    const email = await scheduleOne();

    const result = await reconcileEmails();

    expect(result).toMatchObject({ checked: 1, requeued: 1 });
    expect(enqueueEmail).toHaveBeenCalledWith(email.id, new Date(email.scheduledAt));
  });

  it('does not duplicate jobs that already exist', async () => {
    await scheduleOne();
    vi.mocked(getEmailJobState).mockResolvedValue('delayed');

    const result = await reconcileEmails();

    expect(result.requeued).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('replaces finished jobs that no longer match the database state', async () => {
    const email = await scheduleOne();
    vi.mocked(getEmailJobState).mockResolvedValue('failed');

    await reconcileEmails();

    expect(removeEmailJob).toHaveBeenCalledWith(email.id);
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it('requeues overdue emails with scheduled_at in the past (they run immediately)', async () => {
    const email = await scheduleOne();
    await getPool().query(`UPDATE emails SET scheduled_at = now() - interval '1 hour' WHERE id = $1`, [email.id]);

    await reconcileEmails();

    const [, scheduledAt] = vi.mocked(enqueueEmail).mock.calls[0] as [string, Date];
    expect(scheduledAt.getTime()).toBeLessThan(Date.now());
  });

  it('ignores emails that are already sent or failed', async () => {
    const email = await scheduleOne();
    await getPool().query(`UPDATE emails SET status = 'sent' WHERE id = $1`, [email.id]);

    const result = await reconcileEmails();

    expect(result.checked).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('keeps going and reports errors when one email cannot be queued', async () => {
    await scheduleOne();
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('redis down'));

    const result = await reconcileEmails();

    expect(result).toMatchObject({ checked: 1, requeued: 0, errors: 1 });
  });
});

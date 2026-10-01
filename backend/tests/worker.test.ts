import type { Job } from 'bullmq';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findEmailById, resetStaleProcessing } from '../src/db/emailRepository';
import { getPool } from '../src/db/pool';
import { sendEmail } from '../src/services/mailService';
import type { EmailJobData } from '../src/types';
import { processEmailJob } from '../src/workers/emailProcessor';
import { app, bearer, registerUser, scheduleEmail } from './helpers/api';
import { clearDb, setupTestDb } from './helpers/testDb';

function fakeJob(emailId: string, attemptsMade = 0, attempts = 3): Job<EmailJobData> {
  return { data: { emailId }, attemptsMade, opts: { attempts } } as unknown as Job<EmailJobData>;
}

async function createScheduledEmail() {
  const { token } = await registerUser();
  const created = await scheduleEmail(token);
  return { token, emailId: created.body.data.id as string };
}

beforeAll(setupTestDb);
beforeEach(async () => {
  await clearDb();
  vi.mocked(sendEmail).mockReset();
  vi.mocked(sendEmail).mockResolvedValue({ messageId: 'id' });
});

describe('email status transitions', () => {
  it('moves scheduled -> sent, records sent_at and shows up in the sent list', async () => {
    const { token, emailId } = await createScheduledEmail();

    const result = await processEmailJob(fakeJob(emailId));

    expect(result).toEqual({ outcome: 'sent' });
    expect(sendEmail).toHaveBeenCalledWith({ to: 'recipient@example.com', subject: 'Hello', text: 'Test body' });
    const email = await findEmailById(emailId);
    expect(email?.status).toBe('sent');
    expect(email?.sent_at).toBeInstanceOf(Date);

    const sent = await request(app).get('/api/emails/sent').set(bearer(token));
    const scheduled = await request(app).get('/api/emails/scheduled').set(bearer(token));
    expect(sent.body.data).toHaveLength(1);
    expect(scheduled.body.data).toHaveLength(0);
  });

  it('is in "processing" while the email is being sent', async () => {
    const { emailId } = await createScheduledEmail();
    let statusDuringSend: string | undefined;
    vi.mocked(sendEmail).mockImplementationOnce(async () => {
      statusDuringSend = (await findEmailById(emailId))?.status;
      return { messageId: 'id' };
    });

    await processEmailJob(fakeJob(emailId));

    expect(statusDuringSend).toBe('processing');
  });

  it('marks the email failed with the error message on the last attempt', async () => {
    const { token, emailId } = await createScheduledEmail();
    vi.mocked(sendEmail).mockRejectedValue(new Error('SMTP connection refused'));

    await expect(processEmailJob(fakeJob(emailId, 2, 3))).rejects.toThrow('SMTP connection refused');

    const email = await findEmailById(emailId);
    expect(email?.status).toBe('failed');
    expect(email?.error_message).toBe('SMTP connection refused');
    const sent = await request(app).get('/api/emails/sent').set(bearer(token));
    expect(sent.body.data[0]).toMatchObject({ status: 'failed', errorMessage: 'SMTP connection refused' });
  });

  it('returns the email to "scheduled" when a retry is still available', async () => {
    const { emailId } = await createScheduledEmail();
    vi.mocked(sendEmail).mockRejectedValue(new Error('temporary failure'));

    await expect(processEmailJob(fakeJob(emailId, 0, 3))).rejects.toThrow('temporary failure');

    expect((await findEmailById(emailId))?.status).toBe('scheduled');

    vi.mocked(sendEmail).mockResolvedValue({ messageId: 'id' });
    await processEmailJob(fakeJob(emailId, 1, 3));
    expect((await findEmailById(emailId))?.status).toBe('sent');
  });
});

describe('idempotency', () => {
  it('sends only once when the same job is processed twice concurrently', async () => {
    const { emailId } = await createScheduledEmail();

    const results = await Promise.all([processEmailJob(fakeJob(emailId)), processEmailJob(fakeJob(emailId))]);

    expect(results.map((result) => result.outcome).sort()).toEqual(['sent', 'skipped']);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('skips emails that are already sent or no longer exist', async () => {
    const { emailId } = await createScheduledEmail();
    await processEmailJob(fakeJob(emailId));
    vi.mocked(sendEmail).mockClear();

    const replay = await processEmailJob(fakeJob(emailId));
    const missing = await processEmailJob(fakeJob('00000000-0000-4000-8000-000000000000'));

    expect(replay.outcome).toBe('skipped');
    expect(missing.outcome).toBe('skipped');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('processing recovery', () => {
  it('does not touch rows still in "processing" before they are stale', async () => {
    const { emailId } = await createScheduledEmail();
    await getPool().query(`UPDATE emails SET status = 'processing' WHERE id = $1`, [emailId]);

    expect(await resetStaleProcessing(new Date(Date.now() - 60_000))).toBe(0);
    expect(await resetStaleProcessing(new Date(Date.now() + 60_000))).toBe(1);
    expect((await findEmailById(emailId))?.status).toBe('scheduled');
  });
});

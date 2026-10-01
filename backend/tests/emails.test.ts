import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueEmail } from '../src/queues/emailQueue';
import { app, bearer, inMinutes, registerUser, scheduleEmail } from './helpers/api';
import { clearDb, setupTestDb } from './helpers/testDb';

beforeAll(setupTestDb);
beforeEach(async () => {
  await clearDb();
  vi.mocked(enqueueEmail).mockClear();
  vi.mocked(enqueueEmail).mockResolvedValue(undefined);
});

describe('POST /api/emails/schedule', () => {
  it('stores the email as scheduled and enqueues a delayed job', async () => {
    const { token } = await registerUser();
    const scheduledAt = inMinutes(10);

    const response = await scheduleEmail(token, { scheduledAt });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      toEmail: 'recipient@example.com',
      subject: 'Hello',
      status: 'scheduled',
      sentAt: null,
    });
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith(response.body.data.id, new Date(scheduledAt));
  });

  it('rejects a time in the past without storing or enqueueing anything', async () => {
    const { token } = await registerUser();

    const response = await scheduleEmail(token, { scheduledAt: inMinutes(-5) });

    expect(response.status).toBe(400);
    expect(response.body.error.details.scheduledAt).toMatch(/future/);
    expect(enqueueEmail).not.toHaveBeenCalled();
    const list = await request(app).get('/api/emails/scheduled').set(bearer(token));
    expect(list.body.data).toHaveLength(0);
  });

  it('validates recipient, subject, body and date format', async () => {
    const { token } = await registerUser();

    const response = await scheduleEmail(token, {
      toEmail: 'not-an-email',
      subject: '   ',
      body: '',
      scheduledAt: 'tomorrow',
    });

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.details).sort()).toEqual(['body', 'scheduledAt', 'subject', 'toEmail']);
  });

  it('still saves the email when the queue is unavailable', async () => {
    const { token } = await registerUser();
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('redis down'));

    const response = await scheduleEmail(token);

    expect(response.status).toBe(201);
    const list = await request(app).get('/api/emails/scheduled').set(bearer(token));
    expect(list.body.data).toHaveLength(1);
  });
});

describe('listing emails', () => {
  it('returns scheduled emails soonest first and an empty sent list', async () => {
    const { token } = await registerUser();
    await scheduleEmail(token, { subject: 'Later', scheduledAt: inMinutes(60) });
    await scheduleEmail(token, { subject: 'Sooner', scheduledAt: inMinutes(5) });

    const scheduled = await request(app).get('/api/emails/scheduled').set(bearer(token));
    const sent = await request(app).get('/api/emails/sent').set(bearer(token));

    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data.map((email: { subject: string }) => email.subject)).toEqual(['Sooner', 'Later']);
    expect(sent.body.data).toEqual([]);
  });
});

describe('authorization', () => {
  it("does not let a user see another user's emails", async () => {
    const owner = await registerUser('owner@example.com');
    const other = await registerUser('other@example.com');
    const created = await scheduleEmail(owner.token);
    const emailId = created.body.data.id;

    const ownRead = await request(app).get(`/api/emails/${emailId}`).set(bearer(owner.token));
    const foreignRead = await request(app).get(`/api/emails/${emailId}`).set(bearer(other.token));
    const foreignList = await request(app).get('/api/emails/scheduled').set(bearer(other.token));
    const malformedId = await request(app).get('/api/emails/not-a-uuid').set(bearer(owner.token));

    expect(ownRead.status).toBe(200);
    expect(foreignRead.status).toBe(404);
    expect(foreignList.body.data).toEqual([]);
    expect(malformedId.status).toBe(404);
  });

  it('ignores a user id sent in the request body', async () => {
    const owner = await registerUser('owner2@example.com');
    const attacker = await registerUser('attacker@example.com');

    const created = await scheduleEmail(attacker.token, { userId: owner.userId, user_id: owner.userId });

    const ownerList = await request(app).get('/api/emails/scheduled').set(bearer(owner.token));
    const attackerList = await request(app).get('/api/emails/scheduled').set(bearer(attacker.token));
    expect(created.status).toBe(201);
    expect(ownerList.body.data).toHaveLength(0);
    expect(attackerList.body.data).toHaveLength(1);
  });
});

describe('error handling', () => {
  it('returns consistent JSON for unknown routes and malformed JSON', async () => {
    const unknown = await request(app).get('/api/does-not-exist');
    const badJson = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');

    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');
  });
});

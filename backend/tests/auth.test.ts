import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '../src/db/pool';
import { app, bearer, registerUser } from './helpers/api';
import { clearDb, setupTestDb } from './helpers/testDb';

beforeAll(setupTestDb);
beforeEach(clearDb);

describe('registration and login', () => {
  it('registers a user, hashes the password and never returns the hash', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'New@Example.com', password: 'Password123' });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.email).toBe('new@example.com');
    expect(JSON.stringify(response.body)).not.toContain('password');

    const { rows } = await getPool().query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).not.toBe('Password123');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await registerUser('dup@example.com');
    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'Password123' });
    const weak = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'short' });

    expect(duplicate.status).toBe(409);
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.password).toBeDefined();
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await registerUser('login@example.com', 'Password123');

    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'Password123' });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword1' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123' });

    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toEqual(expect.any(String));
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });
});

describe('authentication protection', () => {
  it('rejects requests without or with an invalid token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/emails/scheduled')).status).toBe(401);
    expect((await request(app).get('/api/emails/sent')).status).toBe(401);
    expect((await request(app).post('/api/emails/schedule').send({})).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer('not-a-real-token'))).status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const session = await registerUser('me@example.com');
    const response = await request(app).get('/api/auth/me').set(bearer(session.token));

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: session.userId, email: 'me@example.com' });
  });
});

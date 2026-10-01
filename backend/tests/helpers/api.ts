import request from 'supertest';
import { createApp } from '../../src/app';

export const app = createApp();

export interface TestSession {
  token: string;
  userId: string;
  email: string;
}

export async function registerUser(email = 'user@example.com', password = 'Password123'): Promise<TestSession> {
  const response = await request(app).post('/api/auth/register').send({ email, password });
  return { token: response.body.data.token, userId: response.body.data.user.id, email };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export async function scheduleEmail(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/emails/schedule')
    .set(bearer(token))
    .send({
      toEmail: 'recipient@example.com',
      subject: 'Hello',
      body: 'Test body',
      scheduledAt: inMinutes(5),
      ...overrides,
    });
}

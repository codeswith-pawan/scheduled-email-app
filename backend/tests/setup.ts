import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.SMTP_HOST = 'smtp.test';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASSWORD = 'password';
process.env.SMTP_FROM = 'Test <test@example.com>';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.SCHEDULE_RATE_LIMIT_MAX = '100000';

// No Redis or SMTP server is needed to run the tests.
vi.mock('../src/queues/emailQueue', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
  getEmailJobState: vi.fn().mockResolvedValue('missing'),
  removeEmailJob: vi.fn().mockResolvedValue(undefined),
  closeEmailQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/mailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  assertSmtpConfigured: vi.fn(),
}));

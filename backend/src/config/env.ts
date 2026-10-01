import 'dotenv/config';
import { z } from 'zod';

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInt(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  WORKER_CONCURRENCY: positiveInt(5),
  EMAIL_RATE_LIMIT_MAX: positiveInt(5),
  EMAIL_RATE_LIMIT_DURATION_MS: positiveInt(10_000),
  RATE_LIMIT_WINDOW_MS: positiveInt(60_000),
  RATE_LIMIT_MAX: positiveInt(100),
  AUTH_RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: positiveInt(20),
  SCHEDULE_RATE_LIMIT_MAX: positiveInt(60),
  RECONCILE_INTERVAL_MS: positiveInt(60_000),
  STALE_PROCESSING_MS: positiveInt(120_000),
});

// Empty values in .env (e.g. `SMTP_USER=`) are treated as "not set".
const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;

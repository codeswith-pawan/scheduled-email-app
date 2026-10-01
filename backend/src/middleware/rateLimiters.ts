import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { TooManyRequestsError } from '../utils/errors';

const handler = (_req: Request, _res: unknown, next: (error: unknown) => void) => {
  next(new TooManyRequestsError());
};

/** Applies to every API request, per client IP. */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

/** Brute-force protection for login and registration, per client IP. */
export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

/** Caps how fast one user can create scheduled emails. Must run after authenticate. */
export const scheduleLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.SCHEDULE_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? 'anonymous',
  handler,
});

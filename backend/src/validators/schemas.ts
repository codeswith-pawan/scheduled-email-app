import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const scheduleEmailSchema = z.object({
  toEmail: z.string().trim().email('Enter a valid recipient email address').max(254),
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be at most 200 characters'),
  body: z.string().trim().min(1, 'Message is required').max(10_000, 'Message must be at most 10,000 characters'),
  scheduledAt: z
    .string({ required_error: 'Scheduled time is required' })
    .datetime({ offset: true, message: 'Scheduled time must be an ISO 8601 date-time' })
    .transform((value) => new Date(value)),
});

export const emailIdSchema = z.string().uuid();

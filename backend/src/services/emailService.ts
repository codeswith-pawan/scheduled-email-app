import {
  createEmail,
  findEmailForUser,
  listScheduledForUser,
  listSentForUser,
} from '../db/emailRepository';
import { toEmailDto } from '../db/mappers';
import { enqueueEmail } from '../queues/emailQueue';
import type { EmailDto } from '../types';
import { NotFoundError, ValidationError } from '../utils/errors';
import { errorMessage, logger } from '../utils/logger';

export interface ScheduleEmailInput {
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

export async function scheduleEmail(userId: string, input: ScheduleEmailInput): Promise<EmailDto> {
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new ValidationError('Scheduled time must be in the future', {
      scheduledAt: 'Scheduled time must be in the future',
    });
  }

  const email = await createEmail({ userId, ...input });

  try {
    await enqueueEmail(email.id, email.scheduled_at);
  } catch (error) {
    // The row is already saved, so nothing is lost: the reconciler re-creates
    // the missing job as soon as Redis is reachable again.
    logger.error(`Could not enqueue email ${email.id}; reconciliation will retry`, {
      reason: errorMessage(error),
    });
  }

  return toEmailDto(email);
}

export async function getScheduledEmails(userId: string): Promise<EmailDto[]> {
  return (await listScheduledForUser(userId)).map(toEmailDto);
}

export async function getSentEmails(userId: string): Promise<EmailDto[]> {
  return (await listSentForUser(userId)).map(toEmailDto);
}

export async function getEmail(userId: string, emailId: string): Promise<EmailDto> {
  const email = await findEmailForUser(emailId, userId);
  if (!email) throw new NotFoundError('Email not found');
  return toEmailDto(email);
}

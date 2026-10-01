import type { Job } from 'bullmq';
import { claimForProcessing, markFailed, markSent, releaseForRetry } from '../db/emailRepository';
import { sendEmail } from '../services/mailService';
import type { EmailJobData } from '../types';
import { errorMessage, logger } from '../utils/logger';

export type ProcessResult = { outcome: 'sent' } | { outcome: 'skipped' };

/**
 * Handles one email job. The atomic claim (scheduled -> processing) is the
 * idempotency guard: a duplicate or replayed job finds the email already
 * claimed/finished and does nothing.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<ProcessResult> {
  const { emailId } = job.data;

  const email = await claimForProcessing(emailId);
  if (!email) {
    logger.info(`Skipping email ${emailId}: not in "scheduled" state`);
    return { outcome: 'skipped' };
  }

  try {
    const result = await sendEmail({ to: email.to_email, subject: email.subject, text: email.body });
    await markSent(emailId);
    logger.info(`Email ${emailId} sent to ${email.to_email}`, { previewUrl: result.previewUrl });
    return { outcome: 'sent' };
  } catch (error) {
    const reason = errorMessage(error);
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (isLastAttempt) {
      await markFailed(emailId, reason);
      logger.error(`Email ${emailId} failed permanently: ${reason}`);
    } else {
      await releaseForRetry(emailId, reason);
      logger.warn(`Email ${emailId} failed (attempt ${job.attemptsMade + 1}), will retry: ${reason}`);
    }
    throw error;
  }
}

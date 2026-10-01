import { env } from '../config/env';
import { listAllScheduled, resetStaleProcessing } from '../db/emailRepository';
import { enqueueEmail, getEmailJobState, removeEmailJob } from '../queues/emailQueue';
import { errorMessage, logger } from '../utils/logger';

export interface ReconcileResult {
  checked: number;
  requeued: number;
  recoveredStale: number;
  errors: number;
}

/**
 * PostgreSQL is the source of truth. This makes the queue match it:
 * every "scheduled" email must have a live BullMQ job. Safe to run repeatedly
 * and from several processes, because job ids are deterministic (email-<id>)
 * and BullMQ ignores an add() for an id that already exists.
 */
export async function reconcileEmails(): Promise<ReconcileResult> {
  const recoveredStale = await resetStaleProcessing(new Date(Date.now() - env.STALE_PROCESSING_MS));
  const scheduled = await listAllScheduled();
  const result: ReconcileResult = { checked: scheduled.length, requeued: 0, recoveredStale, errors: 0 };

  for (const { id, scheduled_at: scheduledAt } of scheduled) {
    try {
      const state = await getEmailJobState(id);
      if (state === 'completed' || state === 'failed') {
        // A finished job for an email that is still "scheduled" is stale; replace it.
        await removeEmailJob(id);
      } else if (state !== 'missing') {
        continue;
      }
      await enqueueEmail(id, scheduledAt);
      result.requeued += 1;
    } catch (error) {
      result.errors += 1;
      logger.error(`Reconciliation failed for email ${id}: ${errorMessage(error)}`);
    }
  }

  if (result.requeued > 0 || result.recoveredStale > 0 || result.errors > 0) {
    logger.info('Reconciliation finished', { ...result });
  }
  return result;
}

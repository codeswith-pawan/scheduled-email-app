import { Worker } from 'bullmq';
import { env } from '../config/env';
import { createRedisConnection } from '../queues/connection';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue';
import type { EmailJobData } from '../types';
import { errorMessage, logger } from '../utils/logger';
import { processEmailJob, type ProcessResult } from './emailProcessor';

export function createEmailWorker(): Worker<EmailJobData, ProcessResult> {
  const worker = new Worker<EmailJobData, ProcessResult>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    // How many jobs this process runs in parallel.
    concurrency: env.WORKER_CONCURRENCY,
    // Throughput cap enforced through Redis: at most `max` jobs started per `duration` ms.
    limiter: { max: env.EMAIL_RATE_LIMIT_MAX, duration: env.EMAIL_RATE_LIMIT_DURATION_MS },
  });

  worker.on('failed', (job, error) => {
    logger.warn(`Job ${job?.id ?? 'unknown'} failed: ${errorMessage(error)}`);
  });
  worker.on('error', (error) => logger.error(`Worker error: ${errorMessage(error)}`));

  return worker;
}

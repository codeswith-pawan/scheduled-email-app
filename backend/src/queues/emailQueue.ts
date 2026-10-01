import { Queue } from 'bullmq';
import { createRedisConnection } from './connection';
import type { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';
export const SEND_EMAIL_JOB = 'send-email';
export const EMAIL_JOB_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 5_000;

export type EmailJobState = 'missing' | 'waiting' | 'delayed' | 'active' | 'completed' | 'failed' | 'other';

let queue: Queue<EmailJobData> | undefined;

function getEmailQueue(): Queue<EmailJobData> {
  queue ??= new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: EMAIL_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: BACKOFF_DELAY_MS },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
  return queue;
}

/** One job per email, so the same email can never be queued twice. */
export const emailJobId = (emailId: string): string => `email-${emailId}`;

export async function enqueueEmail(emailId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await getEmailQueue().add(SEND_EMAIL_JOB, { emailId }, { jobId: emailJobId(emailId), delay });
}

export async function getEmailJobState(emailId: string): Promise<EmailJobState> {
  const job = await getEmailQueue().getJob(emailJobId(emailId));
  if (!job) return 'missing';
  const state = await job.getState();
  return state === 'waiting' || state === 'delayed' || state === 'active' || state === 'completed' || state === 'failed'
    ? state
    : 'other';
}

export async function removeEmailJob(emailId: string): Promise<void> {
  const job = await getEmailQueue().getJob(emailJobId(emailId));
  await job?.remove();
}

export async function closeEmailQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
}

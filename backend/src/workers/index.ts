import { env } from '../config/env';
import { closePool, getPool } from '../db/pool';
import { closeEmailQueue } from '../queues/emailQueue';
import { assertSmtpConfigured } from '../services/mailService';
import { reconcileEmails } from '../services/reconciliationService';
import { errorMessage, logger } from '../utils/logger';
import { createEmailWorker } from './emailWorker';

async function main(): Promise<void> {
  assertSmtpConfigured();
  await getPool().query('SELECT 1');

  const worker = createEmailWorker();
  logger.info(
    `Email worker started (concurrency=${env.WORKER_CONCURRENCY}, ` +
      `limit=${env.EMAIL_RATE_LIMIT_MAX} per ${env.EMAIL_RATE_LIMIT_DURATION_MS}ms)`,
  );

  const reconcile = () =>
    reconcileEmails().catch((error) => logger.error(`Reconciliation error: ${errorMessage(error)}`));
  await reconcile();
  const timer = setInterval(reconcile, env.RECONCILE_INTERVAL_MS);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, finishing active jobs...`);
    clearInterval(timer);
    await worker.close();
    await closeEmailQueue();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error(`Worker failed to start: ${errorMessage(error)}`);
  process.exit(1);
});

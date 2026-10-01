import { createApp } from './app';
import { env } from './config/env';
import { closePool, getPool } from './db/pool';
import { closeEmailQueue } from './queues/emailQueue';
import { reconcileEmails } from './services/reconciliationService';
import { errorMessage, logger } from './utils/logger';

async function main(): Promise<void> {
  await getPool().query('SELECT 1');

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  // Re-create any BullMQ jobs that are missing for emails still marked "scheduled".
  reconcileEmails().catch((error) => logger.error(`Startup reconciliation failed: ${errorMessage(error)}`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await closeEmailQueue();
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error(`Server failed to start: ${errorMessage(error)}`);
  process.exit(1);
});

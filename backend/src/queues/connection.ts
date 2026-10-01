import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger, errorMessage } from '../utils/logger';

// BullMQ requires maxRetriesPerRequest: null for blocking worker connections.
export function createRedisConnection(): IORedis {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (error) => logger.error(`Redis error: ${errorMessage(error)}`));
  return connection;
}

import bcrypt from 'bcryptjs';
import { closePool } from './pool';
import { createUser, findUserByEmail } from './userRepository';
import { logger } from '../utils/logger';

// Local development demo account only. Never use these credentials outside local development.
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Demo@12345';

async function main(): Promise<void> {
  if (await findUserByEmail(DEMO_EMAIL)) {
    logger.info(`Demo user ${DEMO_EMAIL} already exists`);
    return;
  }
  await createUser(DEMO_EMAIL, await bcrypt.hash(DEMO_PASSWORD, 10));
  logger.info(`Created demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(closePool);

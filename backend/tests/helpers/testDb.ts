import { randomUUID } from 'node:crypto';
import { DataType, newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { runMigrations } from '../../src/db/migrate';
import { getPool, setPool } from '../../src/db/pool';

export async function setupTestDb(): Promise<void> {
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
  });
  const { Pool: MemPool } = db.adapters.createPg();
  setPool(new MemPool() as unknown as Pool);
  await runMigrations(getPool());
}

export async function clearDb(): Promise<void> {
  await getPool().query('DELETE FROM emails');
  await getPool().query('DELETE FROM users');
}

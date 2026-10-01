import { Pool } from 'pg';
import { env } from '../config/env';

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: env.DATABASE_URL });
  return pool;
}

// Lets tests swap in an in-memory database.
export function setPool(replacement: Pool): void {
  pool = replacement;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

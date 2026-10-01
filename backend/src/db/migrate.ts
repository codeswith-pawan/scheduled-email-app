import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';
import { closePool, getPool } from './pool';
import { logger } from '../utils/logger';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

export async function runMigrations(pool: Pool): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  const applied = new Set(
    (await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  const executed: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      executed.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return executed;
}

async function main(): Promise<void> {
  const executed = await runMigrations(getPool());
  logger.info(executed.length ? `Applied migrations: ${executed.join(', ')}` : 'Database is up to date');
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exitCode = 1;
    })
    .finally(closePool);
}

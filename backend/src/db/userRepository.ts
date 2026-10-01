import { getPool } from './pool';
import type { UserRow } from '../types';

const COLUMNS = 'id, email, password_hash, created_at, updated_at';

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await getPool().query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await getPool().query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<UserRow> {
  const { rows } = await getPool().query<UserRow>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [email, passwordHash],
  );
  return rows[0] as UserRow;
}

import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { createUser, findUserByEmail, findUserById } from '../db/userRepository';
import { toUserDto } from '../db/mappers';
import type { AuthUser, UserDto } from '../types';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';

const BCRYPT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  user: UserDto;
}

function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub || typeof payload.email !== 'string') {
      throw new UnauthorizedError('Invalid token');
    }
    return { id: payload.sub, email: payload.email };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function registerUser(email: string, password: string): Promise<AuthResult> {
  if (await findUserByEmail(email)) {
    throw new ConflictError('An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const user = await createUser(email, passwordHash);
    return { token: signToken(user), user: toUserDto(user) };
  } catch (error) {
    // 23505 = unique_violation: another request registered the same email first.
    if ((error as { code?: string }).code === '23505') {
      throw new ConflictError('An account with this email already exists');
    }
    throw error;
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !valid) {
    throw new UnauthorizedError('Invalid email or password');
  }
  return { token: signToken(user), user: toUserDto(user) };
}

export async function getCurrentUser(userId: string): Promise<UserDto> {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError('User not found');
  return toUserDto(user);
}

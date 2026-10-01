import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/authService';
import { UnauthorizedError } from '../utils/errors';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }
  try {
    req.user = verifyToken(header.slice('Bearer '.length));
    next();
  } catch (error) {
    next(error);
  }
}

export function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

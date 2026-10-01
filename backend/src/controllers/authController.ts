import type { Request, Response } from 'express';
import { getCurrentUser, loginUser, registerUser } from '../services/authService';
import { requireUser } from '../middleware/authenticate';
import { loginSchema, registerSchema } from '../validators/schemas';

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = registerSchema.parse(req.body);
  const result = await registerUser(email, password);
  res.status(201).json({ success: true, data: result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const result = await loginUser(email, password);
  res.json({ success: true, data: result });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getCurrentUser(requireUser(req).id);
  res.json({ success: true, data: user });
}

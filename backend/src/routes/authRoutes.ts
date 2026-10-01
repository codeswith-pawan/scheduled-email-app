import { Router } from 'express';
import { login, me, register } from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiters';
import { asyncHandler } from '../utils/asyncHandler';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, asyncHandler(register));
authRoutes.post('/login', authLimiter, asyncHandler(login));
authRoutes.get('/me', authenticate, asyncHandler(me));

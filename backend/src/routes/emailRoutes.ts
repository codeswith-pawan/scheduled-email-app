import { Router } from 'express';
import { getById, listScheduled, listSent, schedule } from '../controllers/emailController';
import { authenticate } from '../middleware/authenticate';
import { scheduleLimiter } from '../middleware/rateLimiters';
import { asyncHandler } from '../utils/asyncHandler';

export const emailRoutes = Router();

emailRoutes.use(authenticate);
emailRoutes.post('/schedule', scheduleLimiter, asyncHandler(schedule));
emailRoutes.get('/scheduled', asyncHandler(listScheduled));
emailRoutes.get('/sent', asyncHandler(listSent));
emailRoutes.get('/:id', asyncHandler(getById));

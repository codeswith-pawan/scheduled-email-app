import { Router } from 'express';
import { authRoutes } from './authRoutes';
import { emailRoutes } from './emailRoutes';

export const apiRoutes = Router();

apiRoutes.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/emails', emailRoutes);

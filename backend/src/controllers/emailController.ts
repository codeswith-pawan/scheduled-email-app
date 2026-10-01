import type { Request, Response } from 'express';
import { requireUser } from '../middleware/authenticate';
import { getEmail, getScheduledEmails, getSentEmails, scheduleEmail } from '../services/emailService';
import { NotFoundError } from '../utils/errors';
import { emailIdSchema, scheduleEmailSchema } from '../validators/schemas';

export async function schedule(req: Request, res: Response): Promise<void> {
  const input = scheduleEmailSchema.parse(req.body);
  const email = await scheduleEmail(requireUser(req).id, input);
  res.status(201).json({ success: true, data: email });
}

export async function listScheduled(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getScheduledEmails(requireUser(req).id) });
}

export async function listSent(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getSentEmails(requireUser(req).id) });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = emailIdSchema.safeParse(req.params.id);
  if (!id.success) throw new NotFoundError('Email not found');
  res.json({ success: true, data: await getEmail(requireUser(req).id, id.data) });
}

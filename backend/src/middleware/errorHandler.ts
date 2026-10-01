import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../utils/errors';
import { errorMessage, logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};

function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'body';
    details[field] ??= issue.message;
  }
  return details;
}

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string, details?: Record<string, string>) {
  res.status(status).json({ success: false, error: { code, message, ...(details && { details }) } });
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    send(res, error.statusCode, error.code, error.message, error.details);
    return;
  }
  if (error instanceof ZodError) {
    send(res, 400, 'VALIDATION_ERROR', 'Validation failed', zodDetails(error));
    return;
  }
  if ((error as { type?: string }).type === 'entity.parse.failed') {
    send(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
    return;
  }
  if ((error as { type?: string }).type === 'entity.too.large') {
    send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return;
  }

  // Unknown errors (including database errors): log details, never leak them.
  logger.error(`Unhandled error: ${errorMessage(error)}`, {
    stack: error instanceof Error ? error.stack : undefined,
  });
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
};

import { env } from '../config/env';

type Level = 'info' | 'warn' | 'error';

function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (env.NODE_ENV === 'test') return;
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  const output = meta ? [line, meta] : [line];
  console[level === 'info' ? 'log' : level](...output);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import type {
  ApiResponse,
  AuthResponse,
  Email,
  LoginRequest,
  RegisterRequest,
  ScheduleEmailRequest,
  ScheduleEmailResponse,
  User,
} from '@/types';
import { authStorage } from './authStorage';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;

/** Called when an authenticated request is rejected (expired or invalid token). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  authenticated?: boolean;
}

async function request<T>(path: string, { method = 'GET', body, authenticated = true }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = authStorage.getToken();
  if (authenticated && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check that the backend is running.', 0, 'NETWORK_ERROR');
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || !payload.success) {
    const error = payload && !payload.success ? payload.error : null;
    if (response.status === 401 && authenticated) onUnauthorized?.();
    throw new ApiError(
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.details,
    );
  }

  return payload.data;
}

export const api = {
  register: (data: RegisterRequest) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: data, authenticated: false }),
  login: (data: LoginRequest) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: data, authenticated: false }),
  me: () => request<User>('/auth/me'),
  scheduleEmail: (data: ScheduleEmailRequest) =>
    request<ScheduleEmailResponse>('/emails/schedule', { method: 'POST', body: data }),
  listScheduled: () => request<Email[]>('/emails/scheduled'),
  listSent: () => request<Email[]>('/emails/sent'),
  getEmail: (id: string) => request<Email>(`/emails/${id}`),
};

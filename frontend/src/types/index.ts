export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Email {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface LoginRequest {
  email: string;
  password: string;
}

export type RegisterRequest = LoginRequest;

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ScheduleEmailRequest {
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export type ScheduleEmailResponse = Email;

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmailRow {
  id: string;
  user_id: string;
  to_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: EmailStatus;
  sent_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

export interface EmailDto {
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

export interface EmailJobData {
  emailId: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

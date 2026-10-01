import type { EmailDto, EmailRow, UserDto, UserRow } from '../types';

export function toUserDto(user: UserRow): UserDto {
  return { id: user.id, email: user.email, createdAt: user.created_at.toISOString() };
}

export function toEmailDto(email: EmailRow): EmailDto {
  return {
    id: email.id,
    toEmail: email.to_email,
    subject: email.subject,
    body: email.body,
    scheduledAt: email.scheduled_at.toISOString(),
    status: email.status,
    sentAt: email.sent_at ? email.sent_at.toISOString() : null,
    errorMessage: email.error_message,
    createdAt: email.created_at.toISOString(),
    updatedAt: email.updated_at.toISOString(),
  };
}

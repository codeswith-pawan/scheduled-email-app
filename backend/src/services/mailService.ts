import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export interface SendResult {
  messageId: string;
  previewUrl?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

let transporter: Transporter | undefined;

function getSmtpConfig(): SmtpConfig {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = env;
  const missing = Object.entries({ SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM })
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing SMTP configuration: ${missing.join(', ')}. See README "Ethereal Email setup".`);
  }
  return {
    host: SMTP_HOST as string,
    port: SMTP_PORT as number,
    user: SMTP_USER as string,
    password: SMTP_PASSWORD as string,
    from: SMTP_FROM as string,
  };
}

/** Fails fast at worker startup instead of at the first send. */
export function assertSmtpConfigured(): void {
  getSmtpConfig();
}

function getTransporter(config: SmtpConfig): Transporter {
  transporter ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  const config = getSmtpConfig();
  const info = await getTransporter(config).sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl: previewUrl || undefined };
}

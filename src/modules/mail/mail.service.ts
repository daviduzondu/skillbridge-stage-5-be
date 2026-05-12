import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../../config/env';
import { loadMailTemplateFile, substituteMailTemplate } from './mail-templates';
import type { PasswordResetEmailPayload, SendMailOptions } from './mail.types';
import { OutboundEmailQueueService } from './outbound-email-queue.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client = new Resend(env.RESEND_API_KEY);

  constructor(private readonly outboundEmailQueue: OutboundEmailQueueService) {}

  async send({ to, subject, html, text, from }: SendMailOptions) {
    if (!html && !text) {
      throw new Error('Sending a mail requires either `html` or `text`.');
    }

    const basePayload = {
      from: from ?? env.RESEND_MAIL_FROM,
      to,
      subject,
    };

    const payload: Parameters<Resend['emails']['send']>[0] = html
      ? { ...basePayload, html, ...(text ? { text } : {}) }
      : { ...basePayload, text: text! };

    const { data, error } = await this.client.emails.send(payload);

    if (error) {
      this.logger.error(
        `Failed to send email to ${String(to)}: ${error.message}`,
      );
      throw new Error(error.message);
    }

    return data;
  }

  /** Enqueues when REDIS_URL is set; otherwise sends immediately (still off the forgot-password await path when called from the password-reset worker). */
  async sendPasswordReset(params: PasswordResetEmailPayload): Promise<unknown> {
    return this.outboundEmailQueue.enqueuePasswordReset(params);
  }

  async sendVerificationOtp(params: {
    to: string;
    otp: string;
    expiresAt: Date;
    recipientFirstName: string;
  }) {
    const expiresInMinutes = Math.max(
      1,
      Math.ceil((params.expiresAt.getTime() - Date.now()) / (60 * 1000)),
    );
    const padded = params.otp.padStart(6, '0');
    const digits = padded.split('');
    const digitVars = Object.fromEntries(
      digits.map((d, i) => [`digit${i + 1}`, d]),
    ) as Record<string, string>;

    const base = env.FRONTEND_URL.replace(/\/$/, '');
    const logoUrl =
      env.EMAIL_LOGO_URL ??
      'https://placehold.co/140x40/1f5f6b/ffffff/png?text=SkillBridge';

    const vars: Record<string, string> = {
      name: params.recipientFirstName.trim() || 'there',
      verifyUrl: `${base}/verify-email`,
      logoUrl,
      playStoreUrl: '',
      appStoreUrl: '',
      playStoreLink: '#',
      appStoreLink: '#',
      supportEmail: env.SUPPORT_EMAIL,
      unsubscribeUrl: `${base}/email-preferences`,
      year: String(new Date().getFullYear()),
      expiresMinutes: String(expiresInMinutes),
      ...digitVars,
    };

    const rawHtml = loadMailTemplateFile('verify-code.html');
    const html = substituteMailTemplate(rawHtml, vars);
    const text = `Hi ${vars.name},\n\nYour SkillBridge verification code is ${padded}. It expires in ${expiresInMinutes} minute(s).\n`;

    return this.send({
      to: params.to,
      subject: 'Verify your SkillBridge email',
      text,
      html,
    });
  }
}

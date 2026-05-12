import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Resend } from 'resend';
import { z } from 'zod';
import { env } from '../../config/env';
import { redisQueueConnection } from '../../config/redis-queue';
import { loadMailTemplateFile, substituteMailTemplate } from './mail-templates';
import type { PasswordResetEmailPayload, SendMailOptions } from './mail.types';

const QUEUE_NAME = 'password-reset-email';

const passwordResetEmailJobSchema = z.object({
  to: z.string().min(1),
  otp: z.string().min(1),
  recipientFirstName: z.string().min(1),
  expiresAt: z.union([z.date(), z.string(), z.number()]),
});

@Injectable()
export class OutboundEmailQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OutboundEmailQueueService.name);
  private readonly client = new Resend(env.RESEND_API_KEY);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  onModuleInit(): void {
    const conn = redisQueueConnection();
    if (!conn) {
      this.logger.log(
        'REDIS_URL not set; password-reset emails send inline after the request returns',
      );
      return;
    }
    this.queue = new Queue(QUEUE_NAME, { connection: conn });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        if (job.name !== 'password-reset') {
          throw new Error(`Unknown outbound email job: ${job.name}`);
        }
        const parsed = passwordResetEmailJobSchema.safeParse(job.data);
        if (!parsed.success) {
          this.logger.error(
            'Invalid password-reset email job payload',
            parsed.error.flatten(),
          );
          throw new Error('Invalid password-reset email job payload');
        }
        await this.sendPasswordResetImmediate(parsed.data);
      },
      { connection: conn },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Outbound email job ${job?.id} failed`,
        err instanceof Error ? err.stack : err,
      );
    });
  }

  async enqueuePasswordReset(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    const conn = redisQueueConnection();
    if (!conn) {
      await this.sendPasswordResetImmediate(payload);
      return;
    }
    await this.queue!.add('password-reset', payload, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async send({ to, subject, html, text, from }: SendMailOptions) {
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

    const { error } = await this.client.emails.send(payload);
    if (error) {
      throw new Error(error.message);
    }
  }

  private async sendPasswordResetImmediate(
    params: PasswordResetEmailPayload,
  ): Promise<void> {
    const otp = params.otp?.trim();
    if (!otp) {
      throw new Error('sendPasswordReset requires a non-empty otp');
    }

    const expiresAt = OutboundEmailQueueService.coerceExpiresAt(
      params.expiresAt,
    );
    const expiresInMinutes = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / (60 * 1000)),
    );

    const name = params.recipientFirstName?.trim() || 'there';
    const padded = otp.padStart(6, '0');
    const digits = padded.split('');
    const digitVars = Object.fromEntries(
      digits.map((d, i) => [`digit${i + 1}`, d]),
    ) as Record<string, string>;

    const base = env.FRONTEND_URL.replace(/\/$/, '');
    const logoUrl =
      env.EMAIL_LOGO_URL ??
      'https://placehold.co/140x40/1f5f6b/ffffff/png?text=SkillBridge';

    const rawHtml = loadMailTemplateFile('password-reset.html');
    const html = substituteMailTemplate(rawHtml, {
      name,
      expiresMinutes: String(expiresInMinutes),
      logoUrl,
      supportEmail: env.SUPPORT_EMAIL,
      unsubscribeUrl: `${base}/email-preferences`,
      year: String(new Date().getFullYear()),
      ...digitVars,
    });

    const text = `Hi ${name},\n\nYour SkillBridge password reset code is ${padded}. It expires in ${expiresInMinutes} minute(s).\n\nIf you did not request a reset, ignore this email.`;

    await this.send({
      to: params.to,
      subject: 'Reset your SkillBridge password',
      text,
      html,
    });
  }

  private static coerceExpiresAt(value: Date | string | number): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Invalid expiresAt for password reset email');
    }
    return d;
  }
}

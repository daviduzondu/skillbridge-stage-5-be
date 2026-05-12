import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { redisQueueConnection } from '../../config/redis-queue';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';

const QUEUE_NAME = 'password-reset';

export type PasswordResetJobData = { userId: string };

@Injectable()
export class PasswordResetQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PasswordResetQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private inlinePending = 0;
  private inlineIdleWaiters: Array<() => void> = [];

  constructor(
    private readonly passwordResetDeliveryService: PasswordResetDeliveryService,
  ) {}

  onModuleInit(): void {
    const conn = redisQueueConnection();
    if (!conn) {
      this.logger.log(
        'REDIS_URL not set; password-reset delivery runs inline (async) after the request returns',
      );
      return;
    }
    this.queue = new Queue(QUEUE_NAME, { connection: conn });
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const { userId } = job.data as PasswordResetJobData;
        await this.passwordResetDeliveryService.deliverForUser(userId);
      },
      { connection: conn },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Password reset job ${job?.id} failed`,
        err instanceof Error ? err.stack : err,
      );
    });
  }

  /** Queue delivery so the HTTP handler does not await token issuance or email I/O. */
  enqueue(userId: string): void {
    const conn = redisQueueConnection();
    if (!conn) {
      // Best-effort only: if the process exits before setImmediate runs or before
      // delivery finishes, the email is never sent (unlike BullMQ jobs persisted in Redis).
      this.inlinePending++;
      setImmediate(() => {
        void (async () => {
          try {
            await this.passwordResetDeliveryService.deliverForUser(userId);
          } catch (err) {
            this.logger.error(
              'Inline password-reset delivery failed',
              err instanceof Error ? err.stack : err,
            );
          } finally {
            this.inlinePending--;
            this.flushInlineWaiters();
          }
        })();
      });
      return;
    }
    void this.queue!.add(
      'password-reset-delivery',
      { userId } satisfies PasswordResetJobData,
      { removeOnComplete: true, removeOnFail: false },
    ).catch((err: unknown) => {
      this.logger.error(
        'Failed to enqueue password-reset job',
        err instanceof Error ? err.stack : err,
      );
    });
  }

  /** For e2e when REDIS_URL is unset: wait until inline deliveries finish. */
  awaitIdleForTests(): Promise<void> {
    if (redisQueueConnection()) return Promise.resolve();
    if (this.inlinePending === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.inlineIdleWaiters.push(resolve);
    });
  }

  private flushInlineWaiters(): void {
    if (this.inlinePending === 0 && this.inlineIdleWaiters.length > 0) {
      const w = this.inlineIdleWaiters;
      this.inlineIdleWaiters = [];
      for (const r of w) r();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

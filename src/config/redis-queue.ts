import type { ConnectionOptions } from 'bullmq';
import { env } from './env';

/** When unset, password-reset and outbound mail run inline (after response) without Redis. */
export function redisQueueConnection(): ConnectionOptions | null {
  const url = env.REDIS_URL?.trim();
  if (!url) return null;
  return { url };
}

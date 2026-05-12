import { createEnv } from '@t3-oss/env-core';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { parseDurationToMs } from './duration';

dotenv.config();

const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

const durationString = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .transform((value) => {
      parseDurationToMs(value);
      return value;
    });

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().positive().default(5432),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string(),
    DATABASE_NAME: z.string().min(1),
    DATABASE_SYNC: booleanString.default(false),
    DATABASE_LOGGING: booleanString.default(false),
    DATABASE_SSL: booleanString.default(false),
    DATABASE_SSL_CA: z.string().optional(),

    REDIS_URL: z.string().url().optional(),

    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_ACCESS_EXPIRES_IN: durationString('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    JWT_REFRESH_EXPIRES_IN: durationString('7d'),
    VERIFICATION_OTP_EXPIRES_IN: durationString('15m'),
    VERIFICATION_RESEND_LIMIT_PER_HOUR: z.coerce
      .number()
      .int()
      .positive()
      .default(3),

    PASSWORD_RESET_OTP_EXPIRES_IN: durationString('15m'),
    TOTP_ENCRYPTION_KEY: z.string().min(64),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    /**
     * Cross-origin browser clients (SPA on a different site than this API) need `none`
     * so Set-Cookie is accepted; requires HTTPS (`Secure` is enforced when `none`).
     * Same-site setups can keep `strict` (default).
     */
    AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
    SWAGGER_ENABLED: booleanString.default(true),
    RESEND_API_KEY: z.string().min(1),
    RESEND_MAIL_FROM: z.email(),
    SEED_ADMIN_EMAIL: z.email().default('admin@example.com'),
    SEED_ADMIN_PASSWORD: z.string().min(12).default('Admin@123456'),
    SEED_ADMIN_FULL_NAME: z.string().min(1).default('Admin User'),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CALLBACK_URL: z.string().min(1),
    GOOGLE_DEFAULT_COUNTRY: z.string().default('Unknown'),

    FRONTEND_URL: z.string().default('http://localhost:5173'),

    /** Optional absolute URL for logo in verification / marketing emails. */
    EMAIL_LOGO_URL: z.string().url().optional(),
    /** Support address shown in transactional emails. */
    SUPPORT_EMAIL: z.email().default('support@skillbridge.com'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;

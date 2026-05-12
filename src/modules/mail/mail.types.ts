export type SendMailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

/** Payload for queued or immediate password-reset email send. */
export type PasswordResetEmailPayload = {
  to: string;
  otp: string;
  recipientFirstName: string;
  /** May be a string when job data is deserialized from Redis (BullMQ). */
  expiresAt: Date | string | number;
};

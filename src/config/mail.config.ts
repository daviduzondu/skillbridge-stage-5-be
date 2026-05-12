import { registerAs } from '@nestjs/config';
import { env } from './env';

const mailConfig = registerAs('mail', () => ({
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_MAIL_FROM,
}));

export default mailConfig;

import { registerAs } from '@nestjs/config';
import { env } from './env';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: env.JWT_ACCESS_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
}));
